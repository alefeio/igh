"use client";

import { useEffect, useState } from "react";

export function CodoSideHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`cabecalho ${scrolled ? "cabecalho-lateral" : ""}`}>
      <div className="container cabecalho-conteudo">
        <a href="#inicio" className="logo" aria-label="Ir para o início">
          IGH - CODÓ
        </a>

        <nav className="menu" aria-label="Menu">
          <a href="#cursos">Cursos</a>
          <a href="#beneficios">Benefícios</a>
          <a href="#galeria">Galeria</a>
          <a href="#contato">Contato</a>
        </nav>
      </div>
    </header>
  );
}

