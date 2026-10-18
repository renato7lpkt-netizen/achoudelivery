import { describe, expect, it } from "vitest";
import { findCep, isValidCpf, maskCpf, stripHouseNumber } from "./br";

describe("CPF", () => {
  it("limita a 11 dígitos com máscara", () => expect(maskCpf("123456789012345")).toBe("123.456.789-01"));
  it("valida CPF correto", () => expect(isValidCpf("529.982.247-25")).toBe(true));
  it("recusa CPF inválido", () => expect(isValidCpf("123.456.789-00")).toBe(false));
});

describe("endereço", () => {
  it("tira o número da casa", () => expect(stripHouseNumber("rua santo andre 358, Centro")).toBe("rua santo andre, Centro"));
  it("acha CEP", () => expect(findCep("Rua A, 35700-000")).toBe("35700000"));
});
