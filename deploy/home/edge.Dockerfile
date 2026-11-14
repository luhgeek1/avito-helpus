# Public entry of the home-server stack: nginx in front of the portal and the API.
# Build context is deploy/home, so nothing else from the repository enters the image.
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
