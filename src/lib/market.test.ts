import { describe, expect, it } from "vitest";
import { sameStreet, splitOrder } from "./market";

describe("divisão do pedido", () => {
  it("entregador da plataforma recebe a taxa inteira e a comissão vale só sobre os produtos", () => {
    const s = splitOrder(40, 6, "PIX", false);
    expect(s).toEqual({ gateway: 1.99, platform: 2.2, courier: 6, payout: 35.81 });
  });
  it("loja com entregador próprio fica com a taxa (como antes)", () => {
    const s = splitOrder(40, 6, "PIX", true);
    expect(s.courier).toBe(0);
    expect(s.platform).toBe(2.53);
    expect(s.payout).toBe(41.48);
  });
  it("as partes somam o total pago", () => {
    const s = splitOrder(57.9, 8.4, "CREDIT_CARD", false);
    expect(Math.round((s.gateway + s.platform + s.courier + s.payout) * 100) / 100).toBe(66.3);
  });
});

describe("endereço encontrado confere com o digitado", () => {
  it("aceita a mesma rua com bairro", () => expect(sameStreet("Rua Santo André, Indústrias 358", "Rua Santo André, Indústrias")).toBe(true));
  it("aceita quando o mapa tem 'Doutor' no nome", () => expect(sameStreet("Rua Claudionor de Castro Bahia 151", "Rua Doutor Claudionor de Castro Bahia, Indústrias")).toBe(true));
  it("ignora acentos e maiúsculas", () => expect(sameStreet("rua santo andre", "Rua Santo André")).toBe(true));
  it("recusa outra rua (o erro do CEP que caiu na Nestor Fóscolo)", () => expect(sameStreet("Rua Claudionor Castro Bahia", "Rua Nestor Fóscolo, 284, Boa Vista")).toBe(false));
  it("sem nome de rua digitado não bloqueia", () => expect(sameStreet("358", "Rua Santo André")).toBe(true));
});
