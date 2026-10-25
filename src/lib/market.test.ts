import { describe, expect, it } from "vitest";
import { deliveryWindow, sameStreet, splitOrder } from "./market";

describe("previsão de entrega", () => {
  const now = new Date(2026, 9, 25, 20, 0);
  const created = new Date(2026, 9, 25, 19, 50).toISOString();
  const store = { prep_time_min: 20, rain_mode: false };
  it("antes de sair: pedido + preparo + coleta + trajeto, janela de 15 min", () => {
    const w = deliveryWindow({ created_at: created, distance_km: 2, status: "preparando" }, store, null, now);
    expect(w.from.toTimeString().slice(0, 5)).toBe("20:21"); // 19:50 + 20 + 5 + 6
    expect(w.to.toTimeString().slice(0, 5)).toBe("20:36");
    expect(w.late).toBe(false);
  });
  it("modo chuva soma tempo", () => {
    const w = deliveryWindow({ created_at: created, distance_km: 2, status: "preparando" }, { prep_time_min: 20, rain_mode: true }, null, now);
    expect(w.from.toTimeString().slice(0, 5)).toBe("20:41");
  });
  it("a caminho com GPS do entregador: minutos até a porta", () => {
    const w = deliveryWindow({ created_at: created, distance_km: 2, status: "saiu_entrega" }, store, 1.5, now);
    expect(w.minutesLeft).toBe(5);
    expect(w.from.toTimeString().slice(0, 5)).toBe("20:05");
  });
  it("janela que já passou é empurrada para frente, nunca mostrada no passado", () => {
    const old = new Date(2026, 9, 25, 18, 0).toISOString();
    const w = deliveryWindow({ created_at: old, distance_km: 2, status: "preparando" }, store, null, now);
    expect(w.late).toBe(true);
    expect(w.from > now).toBe(true);
  });
});

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
