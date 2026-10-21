import { describe, expect, it } from "vitest";
import { sameStreet } from "./market";

describe("endereço encontrado confere com o digitado", () => {
  it("aceita a mesma rua com bairro", () => expect(sameStreet("Rua Santo André, Indústrias 358", "Rua Santo André, Indústrias")).toBe(true));
  it("aceita quando o mapa tem 'Doutor' no nome", () => expect(sameStreet("Rua Claudionor de Castro Bahia 151", "Rua Doutor Claudionor de Castro Bahia, Indústrias")).toBe(true));
  it("ignora acentos e maiúsculas", () => expect(sameStreet("rua santo andre", "Rua Santo André")).toBe(true));
  it("recusa outra rua (o erro do CEP que caiu na Nestor Fóscolo)", () => expect(sameStreet("Rua Claudionor Castro Bahia", "Rua Nestor Fóscolo, 284, Boa Vista")).toBe(false));
  it("sem nome de rua digitado não bloqueia", () => expect(sameStreet("358", "Rua Santo André")).toBe(true));
});
