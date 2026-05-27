/**
 * import-apus.js
 * Populates componentes[] and ref_qty for each catalog item from APU data.
 * Run once: node import-apus.js
 *
 * Price formula (already live in apus.html):
 *   precio = Math.round( sum(cant × vr_unit) × 1.25 / ref_qty )
 */

const fs   = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data', 'catalogo.json');

// Each entry: { id, ref_qty, componentes: [{nombre, und, cant, vr_unit}] }
// Items not listed here keep their current precio and empty componentes.
const APU = [

  /* ── DEMOLICIÓN ──────────────────────────────────────────────────── */
  { id: 'dem-baldosa', ref_qty: 60, componentes: [
    { nombre: 'Mano de Obra',                      und: 'M2',  cant: 60,    vr_unit: 13400 },
    { nombre: 'Herramienta menor puntero y cincel', und: 'UND', cant: 1,     vr_unit: 55000 },
    { nombre: 'Martillo demoledor',                 und: 'DIA', cant: 1,     vr_unit: 31350 },
    { nombre: 'Pala',                               und: 'UND', cant: 1,     vr_unit: 55990 },
  ]},
  { id: 'dem-laminado', ref_qty: 63, componentes: [
    { nombre: 'Mano de Obra',                      und: 'HC',  cant: 63,    vr_unit: 11035 },
    { nombre: 'Herramienta menor puntero y cincel', und: 'UND', cant: 1,     vr_unit: 55000 },
    { nombre: 'Martillo demoledor',                 und: 'DIA', cant: 1,     vr_unit: 31350 },
    { nombre: 'Pala',                               und: 'UND', cant: 1,     vr_unit: 55990 },
  ]},
  { id: 'dem-dry-muro', ref_qty: 10, componentes: [
    { nombre: 'Mano de Obra',                              und: 'M2',  cant: 10, vr_unit: 14451 },
    { nombre: 'Serrucho de punta para Drywall',            und: 'UND', cant: 1,  vr_unit: 8878  },
    { nombre: 'Tijeras de corte lámina',                   und: 'UND', cant: 1,  vr_unit: 21712 },
    { nombre: 'Espátula metálica',                         und: 'UND', cant: 1,  vr_unit: 12540 },
  ]},
  { id: 'dem-dry-techo', ref_qty: 46, componentes: [
    { nombre: 'Mano de Obra',                    und: 'M2',  cant: 46, vr_unit: 14451 },
    { nombre: 'Andamios',                        und: 'DIA', cant: 5,  vr_unit: 49500 },
    { nombre: 'Serrucho de punta para Drywall',  und: 'UND', cant: 1,  vr_unit: 37290 },
    { nombre: 'Tijeras de corte lámina',         und: 'UND', cant: 1,  vr_unit: 21712 },
  ]},
  { id: 'dem-bloque', ref_qty: 9, componentes: [
    { nombre: 'Cuadrilla (2 albañiles c/prestaciones)', und: 'UND', cant: 9, vr_unit: 30551 },
    { nombre: 'Herramienta menor puntero y cincel',     und: 'UND', cant: 1, vr_unit: 55000 },
    { nombre: 'Martillo demoledor',                     und: 'UND', cant: 1, vr_unit: 31350 },
    { nombre: 'Pala',                                   und: 'UND', cant: 1, vr_unit: 55990 },
  ]},

  /* ── REGATAS Y PERFORACIONES ─────────────────────────────────────── */
  { id: 'reg-piso', ref_qty: 30, componentes: [
    { nombre: 'Mano de Obra',                      und: 'M2',  cant: 30,  vr_unit: 13880 },
    { nombre: 'Cortadora eléctrica',               und: 'UND', cant: 3,   vr_unit: 31350 },
    { nombre: 'Disco de corte Dewalt 4,5"',        und: 'UND', cant: 2,   vr_unit: 13200 },
    { nombre: 'Arena (10 ML)',                     und: 'M2',  cant: 90,  vr_unit: 18000 },
    { nombre: 'Cemento',                           und: 'M2',  cant: 1.5, vr_unit: 39000 },
  ]},
  { id: 'reg-muro', ref_qty: 12, componentes: [
    { nombre: 'Mano de Obra',                      und: 'M2',  cant: 12,  vr_unit: 13880 },
    { nombre: 'Cortadora eléctrica',               und: 'UND', cant: 1,   vr_unit: 37620 },
    { nombre: 'Herramienta menor puntero y cincel', und: 'UND', cant: 1,   vr_unit: 55000 },
    { nombre: 'Disco de corte Dewalt 4,5"',        und: 'UND', cant: 1,   vr_unit: 15840 },
    { nombre: 'Arena (10 ML)',                     und: 'M2',  cant: 12,  vr_unit: 18000 },
    { nombre: 'Cemento',                           und: 'M2',  cant: 0.6, vr_unit: 39000 },
  ]},
  { id: 'reg-perf', ref_qty: 3, componentes: [
    { nombre: 'Mano de obra perforación (incl. herramienta)', und: 'UND', cant: 3, vr_unit: 500000 },
  ]},

  /* ── DRYWALL ─────────────────────────────────────────────────────── */
  { id: 'dry-ciel', ref_qty: 358, componentes: [
    { nombre: 'Mano de Obra',                    und: 'M2',  cant: 393.8,   vr_unit: 35000 },
    { nombre: 'Espátula',                        und: 'UND', cant: 1,       vr_unit: 16500 },
    { nombre: 'Omega para techo',                und: 'UND', cant: 202.60,  vr_unit: 4700  },
    { nombre: 'Vigueta para techo',              und: 'UND', cant: 104.30,  vr_unit: 4700  },
    { nombre: 'Lámina yeso estándar 2.44×1.22m', und: 'UND', cant: 120.539, vr_unit: 46900 },
    { nombre: 'Tornillo tapado drywall',         und: 'UND', cant: 25060,   vr_unit: 50    },
    { nombre: 'Tornillo de estructura',          und: 'UND', cant: 10740,   vr_unit: 50    },
    { nombre: 'Masilla Super Mastik',            und: 'GAL', cant: 3,       vr_unit: 55500 },
    { nombre: 'Lija #120',                       und: 'UND', cant: 8,       vr_unit: 2500  },
    { nombre: 'Ángulos',                         und: 'UND', cant: 927.9,   vr_unit: 2998  },
    { nombre: 'Cinta filo',                      und: 'UND', cant: 1,       vr_unit: 40000 },
    { nombre: 'Cinta malla',                     und: 'UND', cant: 1,       vr_unit: 18500 },
  ]},
  { id: 'dry-1c', ref_qty: 41, componentes: [
    { nombre: 'Mano de Obra',                    und: 'M2',  cant: 45.1,  vr_unit: 38000 },
    { nombre: 'Espátula',                        und: 'UND', cant: 1,     vr_unit: 46090 },
    { nombre: 'Paral base 6×2.44 cal. 26',       und: 'UND', cant: 36,    vr_unit: 7500  },
    { nombre: 'Lámina yeso estándar 2.44×1.22m', und: 'UND', cant: 13,    vr_unit: 46900 },
    { nombre: 'Tornillo tapado drywall',         und: 'UND', cant: 2520,  vr_unit: 50    },
    { nombre: 'Tornillo de estructura',          und: 'UND', cant: 1230,  vr_unit: 50    },
    { nombre: 'Masilla Super Mastik',            und: 'GAL', cant: 1,     vr_unit: 55500 },
    { nombre: 'Cinta doble faz',                 und: 'UND', cant: 32.8,  vr_unit: 3808  },
    { nombre: 'Lija #120',                       und: 'UND', cant: 4,     vr_unit: 1980  },
    { nombre: 'Canales',                         und: 'UND', cant: 15.5,  vr_unit: 4700  },
    { nombre: 'Cinta filo',                      und: 'UND', cant: 1,     vr_unit: 40000 },
    { nombre: 'Cinta malla',                     und: 'UND', cant: 1,     vr_unit: 18500 },
  ]},
  { id: 'dry-2c', ref_qty: 30, componentes: [
    { nombre: 'Mano de Obra',                    und: 'M2',  cant: 33,   vr_unit: 38000 },
    { nombre: 'Espátula',                        und: 'UND', cant: 1,    vr_unit: 46090 },
    { nombre: 'Paral base 6×2.44 cal. 26',       und: 'UND', cant: 46,   vr_unit: 7500  },
    { nombre: 'Lámina yeso estándar 2.44×1.22m', und: 'UND', cant: 19,   vr_unit: 46900 },
    { nombre: 'Tornillo tapado drywall',         und: 'UND', cant: 3202, vr_unit: 50    },
    { nombre: 'Tornillo de estructura',          und: 'UND', cant: 900,  vr_unit: 50    },
    { nombre: 'Masilla Super Mastik',            und: 'GAL', cant: 1,    vr_unit: 55500 },
    { nombre: 'Cinta doble faz',                 und: 'UND', cant: 24,   vr_unit: 3808  },
    { nombre: 'Lija #120',                       und: 'UND', cant: 4,    vr_unit: 1980  },
    { nombre: 'Canales',                         und: 'UND', cant: 20.4, vr_unit: 4700  },
    { nombre: 'Cinta filo',                      und: 'UND', cant: 1,    vr_unit: 40000 },
    { nombre: 'Cinta malla',                     und: 'UND', cant: 1,    vr_unit: 18500 },
  ]},
  { id: 'dry-bloque', ref_qty: 13, componentes: [
    { nombre: 'Mano de Obra',  und: 'M2',  cant: 14.3, vr_unit: 35000 },
    { nombre: 'Bloque',        und: 'M2',  cant: 195,  vr_unit: 2800  },
    { nombre: 'Varilla',       und: 'UND', cant: 52,   vr_unit: 6000  },
    { nombre: 'Cemento',       und: 'M2',  cant: 7,    vr_unit: 39000 },
    { nombre: 'Arena',         und: 'M2',  cant: 39,   vr_unit: 18000 },
    { nombre: 'Balde',         und: 'UND', cant: 1,    vr_unit: 10000 },
    { nombre: 'Palustre',      und: 'UND', cant: 1,    vr_unit: 20000 },
    { nombre: 'Boquillera',    und: 'UND', cant: 1,    vr_unit: 30000 },
    { nombre: 'Llana',         und: 'UND', cant: 1,    vr_unit: 40000 },
  ]},

  /* ── PINTURA Y ACABADOS ──────────────────────────────────────────── */
  { id: 'pin-tipo2', ref_qty: 30, componentes: [
    { nombre: 'Mano de Obra',               und: 'JR',  cant: 30,  vr_unit: 10090  },
    { nombre: 'Pintura tipo 2 Viniltex Pintuco', und: 'M2', cant: 0.4, vr_unit: 162000 },
    { nombre: 'Rodillo 9" Goya',            und: 'UND', cant: 1,   vr_unit: 43890  },
    { nombre: 'Brocha 2" Goya',             und: 'UND', cant: 1,   vr_unit: 13640  },
    { nombre: 'Plástico para cubrir',       und: 'M2',  cant: 4,   vr_unit: 20900  },
    { nombre: 'Cinta de enmascarar',        und: 'UND', cant: 2,   vr_unit: 20000  },
    { nombre: 'Cinta para pintar',          und: 'UND', cant: 2,   vr_unit: 17000  },
  ]},
  { id: 'pin-antibac', ref_qty: 110, componentes: [
    { nombre: 'Mano de Obra',               und: 'M2',  cant: 110, vr_unit: 10090  },
    { nombre: 'Pintura acrílica certificada Corona', und: 'UND', cant: 1.7, vr_unit: 480000 },
    { nombre: 'Rodillo 9" Goya',            und: 'UND', cant: 1,   vr_unit: 43890  },
    { nombre: 'Brocha 2" Goya',             und: 'UND', cant: 1,   vr_unit: 13640  },
    { nombre: 'Cinta de enmascarar',        und: 'UND', cant: 2,   vr_unit: 20000  },
    { nombre: 'Cinta para pintar',          und: 'UND', cant: 2,   vr_unit: 17000  },
  ]},
  { id: 'pin-color', ref_qty: 80, componentes: [
    { nombre: 'Mano de Obra',         und: 'M2',  cant: 80,  vr_unit: 10090  },
    { nombre: 'Pintura a color',      und: 'UND', cant: 1.2, vr_unit: 466700 },
    { nombre: 'Rodillo 9" Goya',      und: 'UND', cant: 1,   vr_unit: 43890  },
    { nombre: 'Brocha 2" Goya',       und: 'UND', cant: 1,   vr_unit: 13640  },
    { nombre: 'Cinta de enmascarar',  und: 'UND', cant: 2,   vr_unit: 20000  },
    { nombre: 'Cinta para pintar',    und: 'UND', cant: 2,   vr_unit: 17000  },
  ]},
  { id: 'pin-dbrocha', ref_qty: 22, componentes: [
    { nombre: 'Mano de Obra',         und: 'M2',  cant: 22, vr_unit: 23122  },
    { nombre: 'Pintura a color',      und: 'M2',  cant: 1,  vr_unit: 466700 },
    { nombre: 'Rodillo 9" Goya',      und: 'UND', cant: 1,  vr_unit: 43890  },
    { nombre: 'Brocha 2" Goya',       und: 'UND', cant: 1,  vr_unit: 13640  },
    { nombre: 'Cinta de enmascarar',  und: 'UND', cant: 2,  vr_unit: 20000  },
    { nombre: 'Cinta para pintar',    und: 'UND', cant: 2,  vr_unit: 17000  },
  ]},
  { id: 'pin-micro', ref_qty: 55, componentes: [
    { nombre: 'Mano de obra con material', und: 'UND', cant: 55, vr_unit: 95000 },
  ]},
  { id: 'pin-marm', ref_qty: 9, componentes: [
    { nombre: 'Mano de obra con material', und: 'UND', cant: 9, vr_unit: 77000 },
  ]},
  { id: 'pin-hum', ref_qty: 5, componentes: [
    { nombre: 'Sikafill-12 Impermeabilizante Acrílico 4.4 KG', und: 'GL',  cant: 2.5, vr_unit: 106590 },
    { nombre: 'Puntero',                und: 'UND', cant: 1, vr_unit: 55000 },
    { nombre: 'Martillo',               und: 'UND', cant: 1, vr_unit: 55000 },
    { nombre: 'Pala',                   und: 'UND', cant: 1, vr_unit: 55000 },
    { nombre: 'Espátula metálica',      und: 'UND', cant: 1, vr_unit: 12540 },
    { nombre: 'Mano de obra Maestro',   und: 'JR',  cant: 1, vr_unit: 850000 },
  ]},

  /* ── HIDRÁULICO ──────────────────────────────────────────────────── */
  { id: 'hid-pre', ref_qty: 10, componentes: [
    { nombre: 'Mano de Obra',                        und: 'UND', cant: 10, vr_unit: 49500 },
    { nombre: 'Herramienta cortadora de tubos',      und: 'UND', cant: 1,  vr_unit: 13090 },
    { nombre: 'Tubería de presión 1/2" × 3m',        und: 'ML',  cant: 4,  vr_unit: 9460  },
    { nombre: 'Uniones tubería presión 1/2"',        und: 'UND', cant: 8,  vr_unit: 1539  },
    { nombre: 'Codos tubería presión 1/2"',          und: 'UND', cant: 5,  vr_unit: 2114  },
    { nombre: 'T tubería presión 1/2"',              und: 'UND', cant: 5,  vr_unit: 1210  },
    { nombre: 'Tapón roscado tubería presión 1/2"',  und: 'UND', cant: 5,  vr_unit: 2093  },
    { nombre: 'Soldadura',                           und: 'UND', cant: 2,  vr_unit: 61490 },
    { nombre: 'Limpiador',                           und: 'UND', cant: 1,  vr_unit: 55990 },
    { nombre: 'Estopa',                              und: 'UND', cant: 1,  vr_unit: 14190 },
  ]},
  { id: 'hid-san', ref_qty: 10, componentes: [
    { nombre: 'Mano de Obra',                  und: 'UND', cant: 10, vr_unit: 55000 },
    { nombre: 'Herramienta menor segueta',     und: 'UND', cant: 1,  vr_unit: 13090 },
    { nombre: 'Tubería sanitaria PVC 3m',      und: 'ML',  cant: 4,  vr_unit: 46848 },
    { nombre: 'Uniones tubería sanitaria',     und: 'UND', cant: 5,  vr_unit: 2310  },
    { nombre: 'Codos tubería sanitaria',       und: 'UND', cant: 9,  vr_unit: 3795  },
    { nombre: 'T tubería sanitaria',           und: 'UND', cant: 5,  vr_unit: 8444  },
    { nombre: 'Tapón de prueba sanitario',     und: 'UND', cant: 5,  vr_unit: 7242  },
  ]},

  /* ── ELÉCTRICO Y DATOS ───────────────────────────────────────────── */
  { id: 'ele-gfci', ref_qty: 1, componentes: [
    { nombre: 'Técnico con prestaciones',    und: 'JR',  cant: 1,   vr_unit: 37000  },
    { nombre: 'Ayudante con prestaciones',   und: 'JR',  cant: 1,   vr_unit: 32000  },
    { nombre: 'Tubería EMT',                 und: 'UND', cant: 4,   vr_unit: 45000  },
    { nombre: 'Cable libre de halógeno',     und: 'ML',  cant: 159, vr_unit: 4500   },
    { nombre: 'Cinta aislante',              und: 'UND', cant: 1,   vr_unit: 12000  },
    { nombre: 'Caja 2400 para toma',         und: 'UND', cant: 1,   vr_unit: 9000   },
    { nombre: 'Capuchones',                  und: 'UND', cant: 3,   vr_unit: 1050   },
    { nombre: 'Toma corriente GFCI',         und: 'UND', cant: 1,   vr_unit: 57000  },
  ]},
  { id: 'ele-toma', ref_qty: 13, componentes: [
    { nombre: 'Técnico con prestaciones',    und: 'JR',  cant: 1,   vr_unit: 27000  },
    { nombre: 'Ayudante con prestaciones',   und: 'JR',  cant: 1,   vr_unit: 22000  },
    { nombre: 'Tubería EMT',                 und: 'ML',  cant: 13,  vr_unit: 90000  },
    { nombre: 'Cable libre de halógeno',     und: 'ML',  cant: 180, vr_unit: 4500   },
    { nombre: 'Cinta aislante',              und: 'UND', cant: 2,   vr_unit: 12000  },
    { nombre: 'Caja 2400 para toma',         und: 'UND', cant: 13,  vr_unit: 9000   },
    { nombre: 'Capuchones',                  und: 'UND', cant: 39,  vr_unit: 1050   },
    { nombre: 'Toma corriente',              und: 'UND', cant: 13,  vr_unit: 15000  },
  ]},
  { id: 'ele-int-s', ref_qty: 2, componentes: [
    { nombre: 'Técnico con prestaciones',    und: 'JR',  cant: 1,  vr_unit: 27000  },
    { nombre: 'Ayudante con prestaciones',   und: 'JR',  cant: 2,  vr_unit: 22000  },
    { nombre: 'Tubería EMT',                 und: 'ML',  cant: 4,  vr_unit: 45000  },
    { nombre: 'Cable libre de halógeno',     und: 'ML',  cant: 12, vr_unit: 4500   },
    { nombre: 'Cinta aislante',              und: 'UND', cant: 2,  vr_unit: 35000  },
    { nombre: 'Caja 5400/2800 para interruptor', und: 'UND', cant: 4, vr_unit: 9000 },
    { nombre: 'Capuchones',                  und: 'UND', cant: 12, vr_unit: 1050   },
    { nombre: 'Interruptor sencillo',        und: 'UND', cant: 4,  vr_unit: 15000  },
  ]},
  { id: 'ele-int-d', ref_qty: 2, componentes: [
    { nombre: 'Técnico con prestaciones',    und: 'JR',  cant: 1,  vr_unit: 37000  },
    { nombre: 'Ayudante con prestaciones',   und: 'JR',  cant: 1,  vr_unit: 32000  },
    { nombre: 'Tubería EMT',                 und: 'ML',  cant: 10, vr_unit: 45000  },
    { nombre: 'Cable libre de halógeno',     und: 'ML',  cant: 30, vr_unit: 4500   },
    { nombre: 'Cinta aislante',              und: 'UND', cant: 1,  vr_unit: 35000  },
    { nombre: 'Caja 2400 para interruptor',  und: 'UND', cant: 2,  vr_unit: 9000   },
    { nombre: 'Capuchones',                  und: 'UND', cant: 6,  vr_unit: 1050   },
    { nombre: 'Interruptor doble',           und: 'UND', cant: 2,  vr_unit: 18000  },
  ]},
  { id: 'ele-ilum', ref_qty: 2, componentes: [
    { nombre: 'Técnico con prestaciones',         und: 'JR',  cant: 1,  vr_unit: 37000 },
    { nombre: 'Ayudante con prestaciones',        und: 'JR',  cant: 1,  vr_unit: 32000 },
    { nombre: 'Tubería EMT',                      und: 'ML',  cant: 8,  vr_unit: 90000 },
    { nombre: 'Cable libre de halógeno',          und: 'ML',  cant: 18, vr_unit: 4500  },
    { nombre: 'Cinta aislante',                   und: 'UND', cant: 1,  vr_unit: 12000 },
    { nombre: 'Prensaestopa y cable encauchetado', und: 'UND', cant: 2,  vr_unit: 15000 },
    { nombre: 'Tapa con salida para prensaestopa', und: 'UND', cant: 2,  vr_unit: 3500  },
    { nombre: 'Caja octogonal',                   und: 'UND', cant: 2,  vr_unit: 5000  },
    { nombre: 'Capuchones',                       und: 'UND', cant: 6,  vr_unit: 1050  },
  ]},

  /* ── GRIFERÍA Y POCETAS ──────────────────────────────────────────── */
  { id: 'grif-lav-sub', ref_qty: 1, componentes: [
    { nombre: 'Lavamanos cerámico (submontar)',  und: 'UND', cant: 1, vr_unit: 130000 },
    { nombre: 'Sifón push',                     und: 'UND', cant: 1, vr_unit: 35999  },
    { nombre: 'Desagüe acordeón',               und: 'UND', cant: 1, vr_unit: 24999  },
    { nombre: 'Buge',                           und: 'UND', cant: 1, vr_unit: 3999   },
    { nombre: 'Llave de regulación',            und: 'UND', cant: 1, vr_unit: 8999   },
    { nombre: 'Teflón',                         und: 'UND', cant: 1, vr_unit: 250    },
    { nombre: 'Personal de instalación',        und: 'UND', cant: 1, vr_unit: 55000  },
  ]},
  { id: 'grif-lav-sob', ref_qty: 1, componentes: [
    { nombre: 'Lavamanos cerámico (sobreponer)', und: 'UND', cant: 1, vr_unit: 169999 },
    { nombre: 'Sifón push',                     und: 'UND', cant: 1, vr_unit: 35999  },
    { nombre: 'Desagüe acordeón',               und: 'UND', cant: 1, vr_unit: 24999  },
    { nombre: 'Buge',                           und: 'UND', cant: 1, vr_unit: 3999   },
    { nombre: 'Llave de regulación',            und: 'UND', cant: 1, vr_unit: 8999   },
    { nombre: 'Teflón',                         und: 'UND', cant: 1, vr_unit: 250    },
    { nombre: 'Personal de instalación',        und: 'UND', cant: 1, vr_unit: 55000  },
  ]},
  { id: 'grif-lp-sub', ref_qty: 2, componentes: [
    { nombre: 'Lavaplatos acero inoxidable (submontar)', und: 'UND', cant: 2, vr_unit: 139999 },
    { nombre: 'Llave de regulación',            und: 'UND', cant: 2, vr_unit: 8999   },
    { nombre: 'Sifón push',                     und: 'UND', cant: 2, vr_unit: 35999  },
    { nombre: 'Desagüe acordeón con canasta',   und: 'UND', cant: 2, vr_unit: 20000  },
    { nombre: 'Buge',                           und: 'UND', cant: 2, vr_unit: 3999   },
    { nombre: 'Cinta teflón',                   und: 'UND', cant: 2, vr_unit: 250    },
    { nombre: 'Personal de instalación',        und: 'UND', cant: 2, vr_unit: 55000  },
  ]},
  { id: 'grif-sen-cc', ref_qty: 1, componentes: [
    { nombre: 'Grifería de sensor cuello corto negro', und: 'UND', cant: 1, vr_unit: 388999 },
    { nombre: 'Manguera',                und: 'UND', cant: 1, vr_unit: 11000  },
    { nombre: 'Personal de instalación', und: 'UND', cant: 1, vr_unit: 25000  },
  ]},
  { id: 'grif-sen-cis', ref_qty: 2, componentes: [
    { nombre: 'Grifería de sensor tipo cisne', und: 'UND', cant: 2, vr_unit: 289999 },
    { nombre: 'Manguera',                und: 'UND', cant: 2, vr_unit: 11000  },
    { nombre: 'Personal de instalación', und: 'UND', cant: 2, vr_unit: 25000  },
  ]},
  { id: 'grif-mez', ref_qty: 1, componentes: [
    { nombre: 'Grifería con mezclador tipo cisne', und: 'UND', cant: 1, vr_unit: 292999 },
    { nombre: 'Manguera',                und: 'UND', cant: 1, vr_unit: 11000  },
    { nombre: 'Personal de instalación', und: 'UND', cant: 1, vr_unit: 25000  },
  ]},
  { id: 'grif-san', ref_qty: 1, componentes: [
    { nombre: 'Sanitario en cerámica',   und: 'UND', cant: 1, vr_unit: 440999 },
    { nombre: 'Boquilla',                und: 'UND', cant: 1, vr_unit: 40000  },
    { nombre: 'Personal de instalación', und: 'UND', cant: 1, vr_unit: 80000  },
  ]},

  /* ── MESONES ─────────────────────────────────────────────────────── */
  { id: 'mes-quar', ref_qty: 1, componentes: [
    { nombre: 'Quarzon (suministro, transformación e instalación)', und: 'ML', cant: 1, vr_unit: 1000000 },
  ]},
  { id: 'mes-sint', ref_qty: 1, componentes: [
    { nombre: 'Sinterizado (suministro, transformación e instalación)', und: 'ML', cant: 1, vr_unit: 1550000 },
  ]},
  { id: 'mes-dekt', ref_qty: 1, componentes: [
    { nombre: 'Dekton (suministro, transformación e instalación)', und: 'ML', cant: 1, vr_unit: 3300000 },
  ]},
  { id: 'mes-gran', ref_qty: 1, componentes: [
    { nombre: 'Granito (suministro, transformación e instalación)', und: 'ML', cant: 1, vr_unit: 490000 },
  ]},

  /* ── MOBILIARIO Y SILLAS ─────────────────────────────────────────── */
  { id: 'mob-sil-ger', ref_qty: 1, componentes: [
    { nombre: 'Silla tipo gerente (suministro e instalación)', und: 'UND', cant: 1, vr_unit: 800000 },
  ]},
  { id: 'mob-sil-pt', ref_qty: 1, componentes: [
    { nombre: 'Silla puesto de trabajo (suministro e instalación)', und: 'UND', cant: 1, vr_unit: 550000 },
  ]},
  { id: 'mob-sil-cli', ref_qty: 1, componentes: [
    { nombre: 'Silla en crudo',  und: 'UND', cant: 1, vr_unit: 380000 },
    { nombre: 'Tapizado',        und: 'UND', cant: 1, vr_unit: 80000  },
    { nombre: 'Pintura/lacado',  und: 'UND', cant: 1, vr_unit: 80000  },
  ]},
  { id: 'mob-sil-bar', ref_qty: 1, componentes: [
    { nombre: 'Silla en crudo',  und: 'UND', cant: 1, vr_unit: 330000 },
    { nombre: 'Tapizado',        und: 'UND', cant: 1, vr_unit: 60000  },
    { nombre: 'Pintura/lacado',  und: 'UND', cant: 1, vr_unit: 120000 },
  ]},
  { id: 'mob-polt', ref_qty: 1, componentes: [
    { nombre: 'Poltrona en crudo', und: 'UND', cant: 1, vr_unit: 450000 },
    { nombre: 'Tapizado',          und: 'UND', cant: 1, vr_unit: 120000 },
    { nombre: 'Pintura/lacado',    und: 'UND', cant: 1, vr_unit: 60000  },
  ]},
  { id: 'mob-sofa', ref_qty: 1, componentes: [
    { nombre: 'Sofá (ML)',            und: 'ML',  cant: 1, vr_unit: 1250000 },
    { nombre: 'Tapizado',             und: 'UND', cant: 1, vr_unit: 700000  },
    { nombre: 'Estructura en madera', und: 'UND', cant: 1, vr_unit: 800000  },
    { nombre: 'Dilatadores',          und: 'UND', cant: 1, vr_unit: 15000   },
  ]},

  /* ── VIDRIERÍA ───────────────────────────────────────────────────── */
  { id: 'vid-esp-p', ref_qty: 0.36, componentes: [
    { nombre: 'Espejo pulido (compra mínima)', und: 'UND', cant: 1, vr_unit: 200000 },
  ]},
  { id: 'vid-esp-b', ref_qty: 1, componentes: [
    { nombre: 'Espejo bicelado', und: 'M2',  cant: 1, vr_unit: 250000 },
    { nombre: 'Marco',           und: 'UND', cant: 1, vr_unit: 360000 },
  ]},
  { id: 'vid-frost', ref_qty: 1, componentes: [
    { nombre: 'Vinilo frost (instalación)', und: 'M2', cant: 1, vr_unit: 65000 },
  ]},
  { id: 'vid-6n', ref_qty: 1, componentes: [
    { nombre: 'Vidrio crudo 5mm negro', und: 'M2',  cant: 1, vr_unit: 125000 },
    { nombre: 'Marco plateado',         und: 'UND', cant: 1, vr_unit: 350000 },
    { nombre: 'Marco negro',            und: 'UND', cant: 1, vr_unit: 400000 },
  ]},
  { id: 'vid-6c', ref_qty: 1, componentes: [
    { nombre: 'Vidrio crudo 6mm', und: 'M2',  cant: 1, vr_unit: 120000 },
    { nombre: 'Marco plateado',   und: 'UND', cant: 1, vr_unit: 350000 },
  ]},
  { id: 'vid-8c', ref_qty: 3, componentes: [
    { nombre: 'Vidrio crudo 8mm', und: 'M2',  cant: 3, vr_unit: 200000 },
    { nombre: 'Marco negro',      und: 'UND', cant: 3, vr_unit: 400000 },
  ]},
  { id: 'vid-t5', ref_qty: 8, componentes: [
    { nombre: 'División vidrio templado 5mm', und: 'M2',  cant: 8, vr_unit: 220000 },
    { nombre: 'Marco negro',                  und: 'UND', cant: 3, vr_unit: 550000 },
  ]},
  { id: 'vid-t8', ref_qty: 7.56, componentes: [
    { nombre: 'División vidrio templado 8mm', und: 'M2', cant: 7.56, vr_unit: 450000 },
  ]},

  /* ── CARPINTERÍA — ÁREA COMÚN ────────────────────────────────────── */
  { id: 'car-puerta', ref_qty: 1, componentes: [
    { nombre: 'Puerta entamborada', und: 'M2', cant: 1.75, vr_unit: 450000 },
  ]},
  { id: 'car-recep', ref_qty: 1, componentes: [
    { nombre: 'Mueble',            und: 'ML',  cant: 1.2, vr_unit: 700000 },
    { nombre: 'Instalación',       und: 'UND', cant: 1,   vr_unit: 40000  },
    { nombre: 'Archivador',        und: 'UND', cant: 1,   vr_unit: 450000 },
    { nombre: 'Herrajes × cajón',  und: 'UND', cant: 3,   vr_unit: 70000  },
    { nombre: 'Pasacables',        und: 'UND', cant: 1,   vr_unit: 15000  },
    { nombre: 'Cerradura',         und: 'UND', cant: 1,   vr_unit: 15000  },
  ]},
  { id: 'car-cafe', ref_qty: 1, componentes: [
    { nombre: 'Mueble',           und: 'ML',  cant: 1, vr_unit: 550000 },
    { nombre: 'Instalación',      und: 'UND', cant: 1, vr_unit: 40000  },
    { nombre: 'Iluminación',      und: 'ML',  cant: 1, vr_unit: 120000 },
    { nombre: 'Interruptor',      und: 'UND', cant: 1, vr_unit: 15000  },
    { nombre: 'Herrajes × cajón', und: 'UND', cant: 1, vr_unit: 70000  },
    { nombre: 'Pasacables',       und: 'UND', cant: 1, vr_unit: 15000  },
    { nombre: 'Cerradura',        und: 'UND', cant: 1, vr_unit: 15000  },
  ]},
  { id: 'car-vitr', ref_qty: 1, componentes: [
    { nombre: 'Mueble',           und: 'ML',  cant: 1, vr_unit: 850000 },
    { nombre: 'Instalación',      und: 'UND', cant: 1, vr_unit: 40000  },
    { nombre: 'Iluminación',      und: 'ML',  cant: 1, vr_unit: 120000 },
    { nombre: 'Interruptor',      und: 'UND', cant: 1, vr_unit: 15000  },
    { nombre: 'Herrajes × cajón', und: 'UND', cant: 1, vr_unit: 70000  },
    { nombre: 'Pasacables',       und: 'UND', cant: 1, vr_unit: 15000  },
    { nombre: 'Cerradura',        und: 'UND', cant: 1, vr_unit: 15000  },
  ]},
  { id: 'car-list', ref_qty: 1, componentes: [
    { nombre: 'Listones',    und: 'UND', cant: 1, vr_unit: 900000 },
    { nombre: 'Instalación', und: 'UND', cant: 1, vr_unit: 60000  },
    { nombre: 'Interruptor', und: 'UND', cant: 1, vr_unit: 15000  },
    { nombre: 'Iluminación', und: 'ML',  cant: 1, vr_unit: 120000 },
  ]},

  /* ── CARPINTERÍA — CONSULTORIOS ──────────────────────────────────── */
  { id: 'car-cons-mb', ref_qty: 1, componentes: [
    { nombre: 'Mueble bajo',    und: 'ML',  cant: 2.27, vr_unit: 900000 },
    { nombre: 'Instalación',    und: 'UND', cant: 1,    vr_unit: 40000  },
  ]},
  { id: 'car-cons-ma', ref_qty: 1, componentes: [
    { nombre: 'Mueble alto',    und: 'ML',  cant: 2.27, vr_unit: 650000 },
    { nombre: 'Instalación',    und: 'UND', cant: 1,    vr_unit: 50000  },
    { nombre: 'Iluminación',    und: 'ML',  cant: 1.7,  vr_unit: 120000 },
    { nombre: 'Interruptor',    und: 'UND', cant: 1,    vr_unit: 15000  },
  ]},
  { id: 'car-ester-mb', ref_qty: 1, componentes: [
    { nombre: 'Mueble bajo',       und: 'ML',  cant: 1.8, vr_unit: 900000 },
    { nombre: 'Instalación',       und: 'UND', cant: 2,   vr_unit: 40000  },
    { nombre: 'Herrajes × cajón',  und: 'UND', cant: 8,   vr_unit: 70000  },
  ]},
  { id: 'car-ester-ma', ref_qty: 1, componentes: [
    { nombre: 'Mueble alto',      und: 'ML',  cant: 1, vr_unit: 650000 },
    { nombre: 'Instalación',      und: 'UND', cant: 1, vr_unit: 40000  },
    { nombre: 'Iluminación',      und: 'ML',  cant: 1, vr_unit: 120000 },
    { nombre: 'Interruptor',      und: 'UND', cant: 1, vr_unit: 15000  },
    { nombre: 'Herrajes × cajón', und: 'UND', cant: 1, vr_unit: 70000  },
  ]},
  { id: 'car-aseo', ref_qty: 1, componentes: [
    { nombre: 'Mueble altura completa', und: 'ML',  cant: 2.1, vr_unit: 850000 },
    { nombre: 'Instalación',            und: 'UND', cant: 1,   vr_unit: 30000  },
    { nombre: 'Herrajes × cajón',       und: 'UND', cant: 1,   vr_unit: 70000  },
  ]},

  /* ── CARPINTERÍA — OFICINAS ──────────────────────────────────────── */
  { id: 'car-escrit', ref_qty: 1, componentes: [
    { nombre: 'Mueble',                    und: 'ML',  cant: 1.3, vr_unit: 300000  },
    { nombre: 'Instalación',               und: 'UND', cant: 1,   vr_unit: 40000   },
    { nombre: 'Archivador',                und: 'UND', cant: 1.5, vr_unit: 800000  },
    { nombre: 'Herrajes × cajón',          und: 'UND', cant: 3,   vr_unit: 70000   },
    { nombre: 'Pasacables',                und: 'UND', cant: 1,   vr_unit: 15000   },
    { nombre: 'Ornamentación / Soporte',   und: 'UND', cant: 1,   vr_unit: 110000  },
  ]},
  { id: 'car-puesto', ref_qty: 1, componentes: [
    { nombre: 'Mueble',        und: 'ML',  cant: 1, vr_unit: 250000 },
    { nombre: 'Instalación',   und: 'UND', cant: 1, vr_unit: 30000  },
    { nombre: 'Archivador',    und: 'UND', cant: 1, vr_unit: 450000 },
    { nombre: 'Cerradura',     und: 'UND', cant: 1, vr_unit: 15000  },
    { nombre: 'Ornamentación', und: 'UND', cant: 1, vr_unit: 220000 },
    { nombre: 'Grommet',       und: 'UND', cant: 1, vr_unit: 200000 },
  ]},
  { id: 'car-repisa', ref_qty: 1, componentes: [
    { nombre: 'Repisa',      und: 'ML',  cant: 1, vr_unit: 120000 },
    { nombre: 'Instalación', und: 'UND', cant: 1, vr_unit: 70000  },
    { nombre: 'Herrajes',    und: 'UND', cant: 1, vr_unit: 50000  },
  ]},
  { id: 'car-biblio', ref_qty: 1, componentes: [
    { nombre: 'Mueble',        und: 'ML',  cant: 1, vr_unit: 1000000 },
    { nombre: 'Instalación',   und: 'UND', cant: 1, vr_unit: 30000   },
    { nombre: 'Herrajes',      und: 'UND', cant: 1, vr_unit: 50000   },
    { nombre: 'Iluminación',   und: 'UND', cant: 1, vr_unit: 120000  },
    { nombre: 'Interruptor',   und: 'UND', cant: 1, vr_unit: 15000   },
    { nombre: 'Ornamentación', und: 'UND', cant: 1, vr_unit: 800000  },
  ]},
];

/* ── IMPORT ──────────────────────────────────────────────────────── */
const catalogo = JSON.parse(fs.readFileSync(DATA, 'utf8'));

const map = {};
APU.forEach(e => (map[e.id] = e));

let updated = 0;
let priceChanged = 0;

for (const grp of catalogo) {
  for (const item of grp.items) {
    if (!map[item.id]) continue;
    const apu = map[item.id];
    item.ref_qty    = apu.ref_qty;
    item.componentes = apu.componentes.map(c => ({ ...c }));

    // Recalculate precio from components
    const sum       = apu.componentes.reduce((s, c) => s + c.cant * c.vr_unit, 0);
    const newPrecio = Math.round(sum * 1.25 / apu.ref_qty);
    if (newPrecio !== item.precio) {
      console.log(`  [~] ${item.id}: precio ${item.precio.toLocaleString()} → ${newPrecio.toLocaleString()}`);
      item.precio = newPrecio;
      priceChanged++;
    }
    updated++;
  }
}

fs.writeFileSync(DATA, JSON.stringify(catalogo, null, 2));
console.log(`\nImport complete: ${updated} items updated (${priceChanged} prices recalculated).`);
