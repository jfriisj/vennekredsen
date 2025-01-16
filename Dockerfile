FROM nginx:latest

# Copy your custom configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy website content
COPY html /usr/share/nginx/html

# Expose port 80 for the container
EXPOSE 80
