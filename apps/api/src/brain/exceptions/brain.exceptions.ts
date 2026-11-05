import { ForbiddenException, NotFoundException } from '@nestjs/common';

export class BrainAccessDeniedException extends ForbiddenException {
  constructor(action: string) {
    super(`You do not have permission to ${action} in this organization's Company Brain`);
  }
}

export class BrainReportNotFoundException extends NotFoundException {
  constructor(reportId: string) {
    super(`Report not found: ${reportId}`);
  }
}
