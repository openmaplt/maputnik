# openmap.lt build of Maputnik: a static site served by nginx.
#
# Build from the repository root:
#   docker build -f openmap/Dockerfile -t openmap-editor .
#
# (The upstream Dockerfile in the repo root builds the Go "desktop" binary,
# which openmap.lt does not need.)

FROM node:22-alpine AS build
WORKDIR /maputnik

# The `maputnik-design` dependency is installed from GitHub, which needs git.
RUN apk add --no-cache git

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Same as `npm run build` (type check, then vite) with two differences:
#  - `--base=/`: served from the site root, not the /maputnik/ path upstream uses
#    for GitHub Pages;
#  - MAPUTNIK_INSTRUMENT=false: no coverage instrumentation in the bundle.
# Source maps (30+ MB) are dropped from the image.
ENV MAPUTNIK_INSTRUMENT=false
# Only openmap.lt tile sets in "Data Sources" (see ModalSources.tsx).
ENV VITE_OPENMAP_SOURCES=true
RUN npx tsc \
 && npx vite build --mode=production --base=/ \
 && find dist -name '*.map' -delete

FROM nginx:stable-alpine
COPY openmap/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /maputnik/dist /usr/share/nginx/html
EXPOSE 80
