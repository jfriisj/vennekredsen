package dk.friisjakobsen.security.repository;

import dk.friisjakobsen.security.models.ERole;
import dk.friisjakobsen.security.models.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
	Optional<Role> findByName(ERole name);
}
