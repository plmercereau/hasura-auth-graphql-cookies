# Proof of Concept: Hasura Auth Remote Schema and cookies

- No modification done on Hasura-Auth. Instead, create a wrapped remote schema in a serverless function

## Lessons learned:

### Hasura supports JWT stored in cookies

Add `"header": { "type": "Cookie", "name": "hasura-auth-jwt" }` to `HASURA_GRAPHQL_JWT_SECRET`, and Hasura looks for the JWT in the cookie.

### Frontend and backend in the same domain

In order to work, the frontend and the backend would need to share the same domain name

### Adapt Nhost service URLs?

The basic Nhost service URL would likely need to move from:

```
subdomain.service.region.nhost.run
```

to

```
service.subdmain.rerion.nhost.run
```

### Not everything can be put in the GraphQL schema

- `/graphql` could handle sign-up, sign-in, refresh token
- Keep `/signin/{provider}` and its callback. It would redirect with the cookie attached
- Keep email verification endpoints. It would redirect with the cookie attached

### Refreshing tokens cannot be done through subscriptions

- Remove schemas don't support subscriptions
- We cannot update the cookie headers from a subscription (most likely, but who knows)

### The Hasura console started from the Hasura CLI does not like cookies

When using `http://localhost:9695`, Chrome does not send the cookies on GraphiQL requests.

Workaround: set `HASURA_GRAPHQL_ENABLE_CONSOLE` to `true` and use the console from `http://localhost:8080`. But then the migrations/metadata are not persisted locally.

### Added value

- More secure than localStorage with `httpOnly` cookies: not accessible by JavaScript. Both refresh and access tokens would be virtually invisible to the frontend developer
- Simplifies by a lot: no need to manage refresh token / JWT on the frontend. An only timer to refresh the cookie at the right moment through a GraphQL query would be enough:

```graphql
{
  refreshToken {
    expiresAt
  }
}
```

- No user data is read from the JWT, but directly from the DB. As a result, there is less inconsistency between the DB and the SDK, for instance:

```graphql
signIn(email: "bob@bob.com", password: "sponge"){
    userId
    user { # Remote relationship
        roles {
            role
        }
    }
}
```

### To investigate

- How cookies would work with GraphQL subscriptions and websockets?
