# Product Vision: Sales AI Platform

## Objetivo
Construir una plataforma SaaS multiempresa de CRM ligero potenciado por IA, diseñada específicamente para vendedores, equipos comerciales pequeños, agencias, freelancers y empresas de servicios.

## Usuarios Objetivo
- **Vendedores Independientes:** Personas que necesitan organizar sus leads y seguimientos sin la complejidad de un CRM corporativo.
- **Agencias y Consultoras:** Equipos pequeños que gestionan múltiples clientes y oportunidades comerciales.
- **Freelancers:** Profesionales que requieren un sistema simple para rastrear interacciones y cerrar ventas.

## Problema que Resuelve
La mayoría de los CRM son demasiado complejos (sobrecarga de funciones) o demasiado simples (falta de inteligencia). Sales AI Platform llena este hueco permitiendo que la IA procese información no estructurada (emails, chats, notas) y la convierta en datos estructurados, pero manteniendo siempre la decisión final en manos del humano.

## Alcance MVP
- Gestión de Organizaciones y Usuarios.
- CRM Básico: Empresas, Contactos, Leads, Tareas y Notas.
- IA Manual: Análisis de texto pegado $\to$ Sugerencias estructuradas $\to$ Revisión humana $\to$ Guardado oficial.
- Sistema de Importance Level (LOW to CRITICAL).
- Módulo de Exportación (CSV/JSON).
- Aislamiento Multi-tenant estricto.
- Despliegue dockerizado.

## Alcance Futuro
- Integraciones directas con Gmail y Calendar.
- Automatizaciones de seguimiento mediante BullMQ.
- Dashboards de métricas avanzadas.
- API pública para integraciones externas.
- Soporte para múltiples idiomas en la IA.
