import { SessionUser } from '@octopus/shared';

export type AppEnv = {
  Variables: {
    user: SessionUser;
    userId: number;
  };
};
