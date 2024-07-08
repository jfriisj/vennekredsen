-- Insert a user with ROLE_USER
INSERT INTO users (username, email, password) VALUES ('user1', 'user1@example.com', '$2a$10$nkASp8aF3MmctC8GNRfInOXAnzVBS/K0hWVFM/lIpjz.fDXUQGD0y');
INSERT INTO user_roles (user_id, role_id) VALUES (
                                                     (SELECT id FROM users WHERE username = 'user1'),
                                                     (SELECT id FROM roles WHERE name = 'ROLE_USER')
                                                 );

-- Insert a user with ROLE_MODERATOR
INSERT INTO users (username, email, password) VALUES ('moderator1', 'moderator1@example.com', '$2a$10$b19HNpXTQWjeGPvZNZPqkus5fmXR8nzypsgiQ0JP3hmOZTiTYNWqK');
INSERT INTO user_roles (user_id, role_id) VALUES (
                                                     (SELECT id FROM users WHERE username = 'moderator1'),
                                                     (SELECT id FROM roles WHERE name = 'ROLE_MODERATOR')
                                                 );

-- Insert a user with ROLE_ADMIN
INSERT INTO users (username, email, password) VALUES ('admin1', 'admin1@example.com', '$2a$10$Rof.frJhok2F6MQ7j16zouzonMa/ds3M9jMQ1CO3oSUhLUhERdCo6');
INSERT INTO user_roles (user_id, role_id) VALUES (
                                                     (SELECT id FROM users WHERE username = 'admin1'),
                                                     (SELECT id FROM roles WHERE name = 'ROLE_ADMIN')
                                                 );
