import type { CORSOptions, YogaInitialContext } from '@graphql-yoga/node'

export type Context = YogaInitialContext

export type CreateServerProps = {
  /**
   * GraphQL Yoga CORS configuration
   * @see {@link https://www.the-guild.dev/graphql/yoga-server/docs/features/cors}
   */
  cors?: CORSOptions
  /**
   * Whether to enable the GraphiQL interface
   */
  graphiql?: boolean
}
