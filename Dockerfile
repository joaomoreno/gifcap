# ========== Compile Encoder ==========
FROM emscripten/emsdk AS encoder-stage
WORKDIR /

RUN apt update && apt install -y autoconf

COPY ./encoder ./encoder
RUN cd encoder && ./configure && \
    make


# ========== Build Stage ==========
FROM node:14 AS build-stage
WORKDIR /app
COPY . .

# Install build tools and dependencies
RUN apt-get update && \
    apt-get install -y build-essential autoconf automake libtool

# Install npm dependencies and build
RUN npm install
RUN npm run build


# ========== Main Stage ==========
FROM httpd AS main-stage

# Copy artifacts from the build stage
COPY --from=build-stage /app/dist/*.js /usr/local/apache2/htdocs/dist/
COPY --from=build-stage /app/*.css /usr/local/apache2/htdocs/
COPY --from=build-stage /app/*.html /usr/local/apache2/htdocs/
COPY --from=build-stage /app/README.md /usr/local/apache2/htdocs/
COPY --from=build-stage /app/LICENSE /usr/local/apache2/htdocs/
COPY --from=build-stage /app/media /usr/local/apache2/htdocs/media
COPY --from=encoder-stage /encoder/*.js /usr/local/apache2/htdocs/encoder/
COPY --from=encoder-stage /encoder/*.wasm /usr/local/apache2/htdocs/encoder/

