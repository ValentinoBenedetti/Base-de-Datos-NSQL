FROM nginx:alpine

# Remove default nginx configs
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets to Nginx html directory
COPY index.html style.css app.js /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
