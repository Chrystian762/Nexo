package br.com.nexo.api;

import org.springframework.boot.SpringApplication;

public class TestNexoApiApplication {

	public static void main(String[] args) {
		SpringApplication.from(NexoApiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
