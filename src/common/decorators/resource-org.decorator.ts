import { SetMetadata } from '@nestjs/common';

// Identifies which entity OrganizationAccessGuard must load to resolve the tenant
// (organization) a request targets, since routes are flat (/projects/:id, /tasks/:id)
// instead of nested under /organizations/:organizationId.
export type ResourceType = 'organization' | 'project' | 'task';

export interface ResourceOrgMeta {
  type: ResourceType;
  // where to read the identifier from on the incoming request
  source: 'param' | 'body' | 'query';
  // property name to read at that source
  key: string;
}

export const RESOURCE_ORG_KEY = 'resourceOrg';

export const ResourceOrg = (
  type: ResourceType,
  options: Partial<Pick<ResourceOrgMeta, 'source' | 'key'>> = {},
) =>
  SetMetadata<string, ResourceOrgMeta>(RESOURCE_ORG_KEY, {
    type,
    source: options.source ?? 'param',
    key: options.key ?? 'id',
  });
