import { createServer, YogaInitialContext } from '@graphql-yoga/node'
import SchemaBuilder from '@pothos/core'
import axios from 'axios'
import { Context, CreateServerProps } from './types'
import cookie, { CookieSerializeOptions } from 'cookie'

const JWT_COOKIE = 'hasura-auth-jwt'
const REFRESH_COOKIE = 'hasura-auth-refresh'
export type AuthResponse = {
  userId: string | null
  needsEmailVerification: boolean
}
export const setCookies = (
  context: Context,
  {
    accessToken,
    refreshToken,
    accessTokenExpiresIn
  }: { refreshToken: string; accessToken: string; accessTokenExpiresIn: number }
) => {
  const options: CookieSerializeOptions = {
    httpOnly: true,
    sameSite: 'lax' // TODO 'strict' with secure = true
    // secure: true, // TODO only in production (https)
  }

  context.request.headers.append(
    'Set-Cookie',
    cookie.serialize(JWT_COOKIE, accessToken, {
      ...options,

      maxAge: accessTokenExpiresIn
    })
  )
  context.request.headers.append(
    'Set-Cookie',
    cookie.serialize(REFRESH_COOKIE, refreshToken, {
      ...options,
      maxAge: 60 * 60 * 24 * 30 // * 30 days, in seconds
    })
  )
}

/**
 * @returns GraphQL Yoga http server
 */
export const createHasuraAuthGraphQLServer = ({
  graphiql = true,
  cors
}: CreateServerProps = {}) => {
  const builder = new SchemaBuilder<{
    Context: Context
    Objects: {
      AuthResponse: AuthResponse
    }
  }>({})
  const AuthResponse = builder.objectType('AuthResponse', {
    fields: t => ({
      needsEmailVerification: t.exposeBoolean('needsEmailVerification', {}),
      userId: t.exposeString('userId', { nullable: true })
    })
  })
  builder.mutationType({
    fields: t => ({
      signUp: t.field({
        type: AuthResponse,
        args: { email: t.arg.string(), password: t.arg.string() },
        resolve: async (_parent, { email, password }, context) => {
          const { status, data, statusText } = await axios.post<{
            session: any
            mfa: any
            error: any
          }>(process.env.NHOST_BACKEND_URL + '/v1/auth/signup/email-password', {
            email,
            password
          })
          if (status !== 200) {
            // TODO
            throw Error('Failed to sign up' + statusText)
          }
          const { session, mfa } = data
          if (!session) {
            // TODO needs email verification
            return {
              userId: null,
              needsEmailVerification: true
            }
          }
          const { user, ...tokenInfo } = session
          setCookies(context, tokenInfo)
          return {
            needsEmailVerification: false,
            userId: user.id
          }
        }
      }),
      signIn: t.field({
        type: AuthResponse,
        args: { email: t.arg.string(), password: t.arg.string() },
        resolve: async (_, { email, password }, context) => {
          const { status, data, statusText } = await axios.post<{
            session: any
            mfa: any
            error: any
          }>(process.env.NHOST_BACKEND_URL + '/v1/auth/signin/email-password', {
            email,
            password
          })
          if (status !== 200) {
            // TODO
            throw Error('Failed to sign in' + statusText)
          }
          const {
            session: { user, ...tokenInfo },
            mfa
          } = data
          setCookies(context, tokenInfo)

          return {
            userId: user.id,
            // TODO needsEmailVerification can be true with an user ID (if the user has not verified their email)
            needsEmailVerification: false
          }
        }
      })
    })
  })
  builder.queryType({
    fields: t => ({
      refreshToken: t.int({
        resolve: async (_, args, context) => {
          const rawCookies = context.request.headers.get('cookie')

          if (!rawCookies) {
            console.log('no raw cookies')
            // TODO
            throw Error('No cookies')
          }
          const cookies = cookie.parse(rawCookies)

          const refreshToken = cookies[REFRESH_COOKIE]
          if (!refreshToken) {
            console.log('no refreshToken')
            // TODO
            throw Error(`No ${REFRESH_COOKIE} cookie`)
          }
          const { status, data, statusText } = await axios.post<any>(
            process.env.NHOST_BACKEND_URL + '/v1/auth/token',
            {
              refreshToken
            }
          )
          if (status !== 200) {
            // TODO
            throw Error('Failed to sign in' + statusText)
          }
          const { user, ...tokenInfo } = data
          setCookies(context, tokenInfo)
          // TODO return an object
          return tokenInfo.accessTokenExpiresIn
        }
      })
    })
  })

  return createServer({
    cors: (req, { res }) => {
      const setCookie = req.headers.get('Set-Cookie')
      if (setCookie) {
        res.setHeader('Set-Cookie', setCookie.split(','))
      }
      return {
        ...cors
        // exposedHeaders: ['Set-Cookie', 'Cookie', 'Cookies'],
        // allowedHeaders: ['Set-Cookie', 'Cookie', 'Cookies'],
        // credentials: true,
        // origin: '*'
      }
    },
    graphiql,

    context: async (context: YogaInitialContext): Promise<Context> => ({
      ...context
    }),
    schema: builder.toSchema()
  })
}
