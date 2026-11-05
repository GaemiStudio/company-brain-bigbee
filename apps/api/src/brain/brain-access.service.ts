import { Injectable } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { BrainAccessDeniedException } from './exceptions/brain.exceptions';

/**
 * Role checks for Company Brain, kept in the service layer as AGENTS.md asks.
 * Any member may read the channel and post; only OWNER/ADMIN may run the
 * simulation or wipe the demo data.
 */
@Injectable()
export class BrainAccessService {
  private static readonly MANAGE_ROLES: readonly OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];

  constructor(private readonly organizationsService: OrganizationsService) {}

  async requireMember(userId: string, organizationId: string, action: string): Promise<void> {
    const role = await this.organizationsService.getUserRoleInOrganization(userId, organizationId);
    if (!role) {
      throw new BrainAccessDeniedException(action);
    }
  }

  async requireManager(userId: string, organizationId: string, action: string): Promise<void> {
    const role = await this.organizationsService.getUserRoleInOrganization(userId, organizationId);
    if (!role || !BrainAccessService.MANAGE_ROLES.includes(role)) {
      throw new BrainAccessDeniedException(action);
    }
  }
}
