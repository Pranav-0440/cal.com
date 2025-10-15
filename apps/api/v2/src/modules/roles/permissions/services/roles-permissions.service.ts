import { RolesPermissionsOutputService } from "@/modules/roles/permissions/services/roles-permissions-output.service";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type { PermissionString, UpdateRolePermissionsData } from "@calcom/platform-libraries/pbac";
import { RoleService } from "@calcom/platform-libraries/pbac";

@Injectable()
export class RolesPermissionsService {
  constructor(
    private readonly roleService: RoleService,
    private readonly rolesPermissionsOutputService: RolesPermissionsOutputService
  ) {}

  async getRolePermissions(teamId: number, roleId: string) {
    const belongsToTeam = await this.roleService.roleBelongsToTeam(roleId, teamId);
    if (!belongsToTeam) {
      throw new NotFoundException(`Role with id ${roleId} within team id ${teamId} not found`);
    }

    const role = await this.roleService.getRole(roleId);
    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} within team id ${teamId} not found`);
    }

    return this.rolesPermissionsOutputService.getPermissionsFromRole(role);
  }

  async addRolePermissions(teamId: number, roleId: string, permissionsToAdd: PermissionString[]) {
    const belongsToTeam = await this.roleService.roleBelongsToTeam(roleId, teamId);
    if (!belongsToTeam) {
      throw new NotFoundException(`Role with id ${roleId} within team id ${teamId} not found`);
    }

    const current = await this.getRolePermissions(teamId, roleId);
    const desired = Array.from(new Set([...(current || []), ...(permissionsToAdd || [])]));

    const updateData: UpdateRolePermissionsData = {
      roleId,
      permissions: desired,
      updates: {},
    };

    try {
      const updatedRole = await this.roleService.update(updateData);
      return this.rolesPermissionsOutputService.getPermissionsFromRole(updatedRole);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid permissions provided")) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async removeRolePermission(teamId: number, roleId: string, permissionToRemove: PermissionString) {
    const belongsToTeam = await this.roleService.roleBelongsToTeam(roleId, teamId);
    if (!belongsToTeam) {
      throw new NotFoundException(`Role with id ${roleId} within team id ${teamId} not found`);
    }

    const current = await this.getRolePermissions(teamId, roleId);
    const desired = (current || []).filter((p) => p !== permissionToRemove);

    const updateData: UpdateRolePermissionsData = {
      roleId,
      permissions: desired,
      updates: {},
    };

    try {
      await this.roleService.update(updateData);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Invalid permissions provided")) {
          throw new BadRequestException(error.message);
        }
        if (error.message.includes("Cannot update default roles")) {
          throw new BadRequestException(error.message);
        }
      }
      throw error;
    }
  }

  async removeRolePermissions(teamId: number, roleId: string, permissionsToRemove: PermissionString[]) {
    const belongsToTeam = await this.roleService.roleBelongsToTeam(roleId, teamId);
    if (!belongsToTeam) {
      throw new NotFoundException(`Role with id ${roleId} within team id ${teamId} not found`);
    }

    const current = await this.getRolePermissions(teamId, roleId);
    const toRemove = new Set(permissionsToRemove || []);
    const desired = (current || []).filter((p) => !toRemove.has(p));

    const updateData: UpdateRolePermissionsData = {
      roleId,
      permissions: desired,
      updates: {},
    };

    try {
      await this.roleService.update(updateData);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Invalid permissions provided")) {
          throw new BadRequestException(error.message);
        }
        if (error.message.includes("Cannot update default roles")) {
          throw new BadRequestException(error.message);
        }
      }
      throw error;
    }
  }

  async setRolePermissions(teamId: number, roleId: string, permissions: PermissionString[]) {
    const belongsToTeam = await this.roleService.roleBelongsToTeam(roleId, teamId);
    if (!belongsToTeam) {
      throw new NotFoundException(`Role with id ${roleId} within team id ${teamId} not found`);
    }

    const updateData: UpdateRolePermissionsData = {
      roleId,
      permissions: permissions || [],
      updates: {},
    };

    try {
      const updatedRole = await this.roleService.update(updateData);
      return updatedRole.permissions.map((p) => `${p.resource}.${p.action}` as PermissionString);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Invalid permissions provided")) {
          throw new BadRequestException(error.message);
        }
        if (error.message.includes("Cannot update default roles")) {
          throw new BadRequestException(error.message);
        }
      }
      throw error;
    }
  }
}
