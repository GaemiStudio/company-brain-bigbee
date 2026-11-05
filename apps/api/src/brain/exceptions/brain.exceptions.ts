import { ForbiddenException } from '@nestjs/common';

export class BrainAccessDeniedException extends ForbiddenException {
  constructor(action: string) {
    super(`You do not have permission to ${action} in this organization's Company Brain`);
  }
}
