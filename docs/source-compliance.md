# Corresponding Source Operations

> This document describes the NexusClaw Community runtime mechanism. It is
> general operational information, not legal advice. The GNU AGPL v3 license
> controls if this document conflicts with it.

## Required configuration

`COMMUNITY_SOURCE_URL` must identify the Corresponding Source for the exact
version being operated. Production startup accepts only a credential-free
HTTPS URL. A missing value, a `replace-with-...` placeholder, embedded URL
credentials, a fragment or plain HTTP causes startup to fail.

The URL must remain available to every remote user who can interact with the
running version. If an operator modifies the program, rebuilding from or
linking to an unmodified upstream snapshot is not sufficient. The offered
source must match the deployed modification and include the build, install and
other material required by the license's definition of Corresponding Source.

## Runtime disclosure

The backend exposes the configured location in two ways:

- every HTTP response includes `X-NexusClaw-Corresponding-Source` and a `Link`
  header;
- unauthenticated `GET /source` returns the license identifier, official
  license URL and configured Corresponding Source URL.

An application or reverse proxy must preserve these headers and must not hide
or restrict the `/source` endpoint. A user-facing interface built in front of
the API should also display a visible Source link.

## Release and deployment verification

Before exposing a deployment to remote users:

1. publish the exact source tree or archive at the configured URL;
2. verify that the URL is accessible without payment or authentication;
3. verify that it resolves to the same version as the deployed artifact;
4. request `/source` through the real user-facing ingress;
5. inspect an ordinary API response through that ingress and confirm both
   disclosure headers survive any proxy;
6. retain the source-tree, build-artifact and deployment-version digests with
   the release evidence.

Repeat the checks after every modification, rebuild, proxy change or source URL
change. A repository landing page that can move independently of the deployed
artifact should link onward to an immutable tag, commit or archive.

Authoritative license text: [GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html).
