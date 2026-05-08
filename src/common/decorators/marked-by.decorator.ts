import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../entities/user.entity';

/**
 * Resolves the audit string "Full Name (role)" from the JWT-authenticated user.
 * Inject this directly into arrive endpoints so services never build this string
 * themselves — the audit trail always reflects the actual request principal.
 *
 * Usage: markArrived(@MarkedBy() label: string)
 */
export const MarkedBy = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const user: User = ctx.switchToHttp().getRequest().user;
    return `${user.fullName} (${user.role})`;
  },
);
