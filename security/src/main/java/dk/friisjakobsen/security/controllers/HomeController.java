package dk.friisjakobsen.security.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.logging.Logger;

@RestController
public class HomeController {

	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

	@GetMapping("/encrypt")
	public String encryptString(@RequestParam String input) {
		return passwordEncoder.encode(input);
	}
}