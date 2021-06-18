import { createMachine, assign } from 'xstate';
import { createModel } from 'xstate/lib/model';

const loginModel = createModel(
  {
    credentials: {
      username: '',
      password: ''
    },
    error: null as string | null,
    user: null as { clientId: string } | null
  },
  {
    events: {
      LOGIN: (username: string, password: string) => ({ username, password }),
      RETRY: () => ({})
    }
  }
);

export const LoginMachine = (softoneService: any) =>
  createMachine<typeof loginModel>(
    {
      id: 'softne-login',
      context: loginModel.initialContext,
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOGIN: {
              target: 'logginIn',
              actions: 'assignCredentials'
            }
          }
        },
        logginIn: {
          invoke: {
            id: 'loginService',
            src: 'loginService',
            onDone: {
              target: 'authenticating'
            },
            onError: {
              target: 'failure',
              actions: 'assignError'
            }
          }
        },
        authenticating: {
          invoke: {
            id: 'authenticateService',
            src: 'authenticateService',
            onDone: {
              target: 'authenticated',
              actions: 'assignUser'
            },
            onError: {
              target: 'failure',
              actions: 'assignError'
            }
          }
        },
        authenticated: {
          type: 'final'
        },
        failure: {
          on: {
            RETRY: {
              target: 'logginIn',
              actions: 'removeError'
            }
          }
        }
      }
    },
    {
      actions: {
        removeError: loginModel.assign({ error: null }),
        assignUser: loginModel.assign(ctx => {
          const data = e.data;
          return {
            user: {
              clientId: data.clientID
            }
          };
        }),
        assignError: loginModel.assign(
          (ctx, e) => ({
            error: e.data.message
          }),
          undefined
        ),
        assignCredentials: loginModel.assign(
          {
            credentials: (_, e) => ({
              password: e.password,
              username: e.username
            })
          },
          'LOGIN'
        )
      },
      services: {
        loginService: async ({ credentials }, e) => {
          const { username, password } = credentials;
          const result = await softoneService.login({ username, password });
          return result;
        },
        authenticateService: async (_, e) => {
          const data = e.data;
          const objs = data.objs[0];
          const result = await softoneService.authenticate({
            branch: objs.BRANCH,
            clientID: data.clientID,
            company: objs.COMPANY,
            module: objs.MODULE,
            refid: objs.REFID
          });
          return result;
        }
      }
    }
  );

export const events = loginModel.events;
