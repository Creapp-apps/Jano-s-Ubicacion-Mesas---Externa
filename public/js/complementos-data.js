/**
 * miFiestAPP - Catálogo Oficial de Complementos y Servicios
 * Precios oficiales, categorías, características y especificaciones técnicas.
 */

const COMPLEMENTOS_DATA = [
  // --- Categoría: Atracciones & Juegos ---
  {
    id: 'garra-peluches',
    title: 'Máquina Garra de Peluches & Premios',
    subtitle: 'La atracción más viral y divertida para grandes y chicos',
    category: 'juegos',
    categoryName: 'Atracciones & Juegos',
    price: 240000,
    priceFormatted: '$240.000',
    unit: 'por evento completo',
    badge: '⭐ Más Pedido',
    icon: 'arcade',
    imageUrl: '/assets/complementos/garra-peluches.jpg',
    shortDesc: 'Máquina arcade tipo garra con fichas personalizadas, cargada de peluches temáticos o regalos sorpresa de la fiesta.',
    description: 'Llevá la auténtica experiencia arcade a tu fiesta. Los invitados reciben fichas personalizadas con el logo de tu evento para jugar durante toda la noche y llevarse peluches, souvenirs o premios especiales.',
    includes: [
      'Máquina de garra profesional con iluminación LED RGB adaptable a la temática',
      'Carga inicial de 60 peluches premium / premios sorpresa',
      'Fichas personalizadas ilimitadas con el nombre de los homenajeados',
      'Traslado, armado, calibración y retiro post-evento en el salón',
      'Coordinador de asistencia técnica durante el evento'
    ],
    requirements: 'Espacio de 1.2m x 1.2m bajo techo y toma corriente estándar 220V.',
    leadTime: 'Reserva recomendada con 15 días de anticipación.'
  },
  {
    id: 'cabina-360',
    title: 'Plataforma 360° Video Slow-Motion',
    subtitle: 'Videos cinemáticos en tiempo real listos para compartir',
    category: 'juegos',
    categoryName: 'Atracciones & Juegos',
    price: 210000,
    priceFormatted: '$210.000',
    unit: 'por 3 horas de servicio',
    badge: '🔥 Tendencia',
    icon: 'camera',
    imageUrl: '/assets/complementos/cabina-360.jpg',
    shortDesc: 'Plataforma circular giratoria con cámara 4K, efectos de cámara lenta, música personalizada y entrega inmediata por QR o AirDrop.',
    description: 'Los invitados suben a la plataforma mientras el brazo de cámara gira 360° capturando poses épicas. Los videos se procesan al instante con diseño gráfico personalizado del evento, música y efecto Slow-Motion para descargar al celular por QR.',
    includes: [
      'Plataforma para hasta 4 personas en simultáneo',
      'Cámara de alta velocidad 4K con aro de luz profesional',
      'Diseño de marco/overlay personalizado con nombres y fecha',
      'Código QR en pantalla de la plataforma para descarga instantánea',
      '2 operadores durante todo el servicio + props y cotillón temático'
    ],
    requirements: 'Espacio libre de 3m x 3m y conexión eléctrica 220V.',
    leadTime: 'Reserva con 10 días de anticipación.'
  },
  {
    id: 'espejo-magico',
    title: 'Espejo Mágico Fotocabina Touch',
    subtitle: 'Fotos instantáneas impresas con firma interactiva',
    category: 'juegos',
    categoryName: 'Atracciones & Juegos',
    price: 195000,
    priceFormatted: '$195.000',
    unit: 'por 2 horas de servicio',
    badge: '✨ Elegancia',
    icon: 'mirror',
    imageUrl: '/assets/complementos/espejo-magico.jpg',
    shortDesc: 'Espejo de cuerpo entero con pantalla táctil interactiva, animaciones guiadas y fotos impresas ilimitadas en papel fotográfico.',
    description: 'Una experiencia elegante donde los invitados se ven en un espejo gigante que los anima a posar, firmar la pantalla y llevarse su tira de fotos imantada de recuerdo al instante.',
    includes: [
      'Fotos ilimitadas impresas en papel térmico de alta calidad',
      'Tiras fotográficas 5x15cm personalizadas con diseño del evento',
      'Firma digital y emojis dibujados en la pantalla táctil',
      'Álbum de firmas encuadernado para que los invitados dejen su foto con dedicatoria',
      'Galería digital completa post-evento en alta resolución'
    ],
    requirements: 'Espacio de 2.5m x 2m cerca de una toma de corriente.',
    leadTime: 'Reserva con 15 días de anticipación.'
  },

  // --- Categoría: Logística & Traslados ---
  {
    id: 'micro-invitados',
    title: 'Transporte en Micro para Invitados',
    subtitle: 'Comodidad y seguridad total para la ida y vuelta',
    category: 'logistica',
    categoryName: 'Logística & Traslados',
    price: 280000,
    priceFormatted: '$280.000',
    unit: 'hasta 45 pasajeros (Ida y Vuelta)',
    badge: '🛡️ Seguridad',
    icon: 'bus',
    imageUrl: '/assets/complementos/micro-invitados.jpg',
    shortDesc: 'Unidades modernas de larga distancia con aire acondicionado, audio y chofer habilitado para coordinar el traslado seguro de los invitados.',
    description: 'Garantizá que todos tus invitados lleguen a tiempo y regresen seguros sin preocuparse por manejar o estacionar. Puntos de encuentro coordinados y monitoreo permanente.',
    includes: [
      'Unidad ejecutiva de 45 asientos reclinables con cinturón de seguridad',
      'Climatización frío/calor, cortinas y sistema de sonido para previa musical',
      'Punto de salida a elección en AMBA / CABA hacia el salón',
      'Regreso coordinado al finalizar la fiesta (o 2 horarios de regreso)',
      'Seguro de pasajeros y habilitación CNRT vigente'
    ],
    requirements: 'Definición de punto de ascenso y descenso con 7 días de anticipación.',
    leadTime: 'Reserva con 20 días de anticipación.'
  },
  {
    id: 'combi-vip',
    title: 'Combi Ejecutiva VIP / Minibús',
    subtitle: 'Traslado ágil y exclusivo para familia o amigos íntimos',
    category: 'logistica',
    categoryName: 'Logística & Traslados',
    price: 180000,
    priceFormatted: '$180.000',
    unit: 'hasta 19 pasajeros (Ida y Vuelta)',
    badge: '👑 Exclusivo',
    icon: 'van',
    imageUrl: '/assets/complementos/combi-vip.jpg',
    shortDesc: 'Minibús Mercedes-Benz Sprinter de 19 plazas con chofer profesional y horarios flexibles.',
    description: 'La opción ideal para trasladar al grupo de amigos más íntimo, damas de honor o familiares directos con la máxima comodidad y puntualidad.',
    includes: [
      'Minibús Sprinter de última generación con tapizados de cuero',
      'Conexión USB de carga en asientos y Wi-Fi a bordo',
      'Chofer profesional en traje con comunicación directa',
      'Coordinación de hasta 2 paradas de búsqueda intermedias'
    ],
    requirements: 'Detalle de direcciones de parada acordadas con anterioridad.',
    leadTime: 'Reserva con 10 días de anticipación.'
  },

  // --- Categoría: Diseño & Impresión 3D ---
  {
    id: 'cake-topper-3d',
    title: 'Cake Topper 3D con Nombres & Temática',
    subtitle: 'La corona de tu torta con acabados metalizados o translúcidos',
    category: 'impresion',
    categoryName: 'Diseño & Impresión 3D',
    price: 35000,
    priceFormatted: '$35.000',
    unit: 'por diseño exclusivo',
    badge: '🎂 Souvenir Único',
    icon: 'cube',
    imageUrl: '/assets/complementos/cake-topper-3d.jpg',
    shortDesc: 'Nombre(s) o silueta de homenajeados en 3D de alta definición, con terminación dorada, glitter, cromada o neón.',
    description: 'Diseño tridimensional a medida para colocar en la cima de la torta principal. Luego de la fiesta, se convierte en una pieza decorativa de recuerdo inolvidable.',
    includes: [
      'Diseño y render digital 3D previo para aprobación del cliente',
      'Impresión en resina de alta precisión o filamento ecológico PLA+',
      'Acabado a elección: Oro pulido, Champagne satinado, Blanco perlado o Glow in the dark',
      'Varilla de soporte higiénica apta para alimentos',
      'Caja protectora de presentación para guardarlo de por vida'
    ],
    requirements: 'Envío de nombres y tipografía deseada al momento de la confirmación.',
    leadTime: 'Producción en 5 días hábiles.'
  },
  {
    id: 'centros-mesa-3d',
    title: 'Centros de Mesa Lumínicos 3D con QR Integrado',
    subtitle: 'Elegancia escultural en cada mesa con iluminación LED tenue',
    category: 'impresion',
    categoryName: 'Diseño & Impresión 3D',
    price: 85000,
    priceFormatted: '$85.000',
    unit: 'pack x 10 centros de mesa',
    badge: '💡 Innovación',
    icon: 'lamp',
    imageUrl: '/assets/complementos/centros-mesa-3d.jpg',
    shortDesc: 'Centros de mesa geométricos impresos en 3D con luz cálida interna y código QR de miFiestAPP en relieve.',
    description: 'Fusioná la tecnología de miFiestAPP con la ambientación física del salón. Cada mesa luce una pieza de diseño que guía a los invitados a escanear para ver su mesa y subir fotos a la pantalla.',
    includes: [
      'Estructura 3D geométrica personalizada con número de mesa grabado',
      'Módulo LED recargable de luz cálida de 12 horas de autonomía',
      'QR de miFiestAPP grabado con acabado en contraste de alta legibilidad',
      'Diseño coordinado con la temática del salón'
    ],
    requirements: 'Definir cantidad de mesas del salón.',
    leadTime: 'Producción en 8 días hábiles.'
  },

  // --- Categoría: Papelería & Cartelería ---
  {
    id: 'invitaciones-impresas',
    title: 'Invitaciones Físicas Luxury con Hot Stamping',
    subtitle: 'El primer contacto táctil y elegante con tus invitados',
    category: 'grafica',
    categoryName: 'Papelería & Gráfica',
    price: 95000,
    priceFormatted: '$95.000',
    unit: 'pack x 50 unidades',
    badge: '✉️ Lujo Clásico',
    icon: 'envelope',
    imageUrl: '/assets/complementos/invitaciones-impresas.jpg',
    shortDesc: 'Tarjetonería en papel italiano de 350gr con stamping dorado/oro rosa, sobre calado y QR directo a la invitación digital.',
    description: 'El complemento ideal para combinar la tradición de entregar una tarjeta física con la potencia interactiva de la invitación digital de miFiestAPP.',
    includes: [
      '50 tarjetas impresas en papel textured de alto gramaje (350gr)',
      'Detalles en foil / hot stamping metalizado (oro, plata o rose gold)',
      'Sobres artesanales con forro interior personalizado o lacre de cera',
      'Código QR impreso directo a la invitación web interactiva de miFiestAPP',
      'Diseño gráfico 100% coordinado con el estilo de la web'
    ],
    requirements: 'Aprobación del diseño final.',
    leadTime: 'Producción en 7 días hábiles.'
  },
  {
    id: 'cartel-neon-led',
    title: 'Cartel de Bienvenida en Neón LED a Medida',
    subtitle: 'El rincón más fotografiado del salón',
    category: 'grafica',
    categoryName: 'Papelería & Gráfica',
    price: 130000,
    priceFormatted: '$130.000',
    unit: 'por cartel personalizado (queda para vos)',
    badge: '📸 Foto Spot',
    icon: 'sparkle',
    imageUrl: '/assets/complementos/cartel-neon-led.jpg',
    shortDesc: 'Frase, apellidos o nombres en Neón LED flexible montado sobre acrílico transparente de 4mm con dimmer de intensidad.',
    description: 'Ubicado en el hall de entrada o en la pista de baile, este cartel ilumina el evento y se convierte en el fondo obligado de todas las selfies. Al terminar la fiesta, te lo llevás para colgar en tu casa.',
    includes: [
      'Cartel Neón LED de alta luminosidad (hasta 90cm de ancho)',
      'Placa de acrílico cristal cortada con láser con perforaciones para colgar',
      'Transformador a 220V con control remoto y regulador de intensidad',
      'Color a elección: Blanco cálido, Dorado champagne, Rosa pastel o Azul eléctrico',
      'Embalaje de máxima protección'
    ],
    requirements: 'Aprobación de la tipografía y frase.',
    leadTime: 'Producción en 10 días hábiles.'
  },

  // --- Categoría: Efectos Especiales & Ambientación ---
  {
    id: 'chispas-frias',
    title: 'Pack Chisperos Fríos Indoor (Vals / Entrada)',
    subtitle: 'Momento cinematográfico sin humo ni riesgo de quemaduras',
    category: 'efectos',
    categoryName: 'Efectos & Ambientación',
    price: 160000,
    priceFormatted: '$160.000',
    unit: '4 máquinas con 2 disparos sincronizados',
    badge: '🎆 Cinemático',
    icon: 'fire',
    imageUrl: '/assets/complementos/chispas-frias.jpg',
    shortDesc: 'Máquinas de fuegos artificiales fríos no pirotécnicos, aptos para salones cerrados, sin olor ni peligro.',
    description: 'Elevá el impacto visual en el momento de la entrada triunfal, el vals de novios o el corte de torta. Chispas doradas de hasta 3 metros de altura disparadas por control inalámbrico.',
    includes: [
      '4 máquinas de chispas frías de última generación (Cold Spark)',
      '2 disparos cronometrados de 30 segundos cada uno',
      'Operador técnico especializado para la activación sincronizada',
      '100% seguro para salones cerrados y ropa de gala'
    ],
    requirements: 'Autorización previa del salón de eventos.',
    leadTime: 'Reserva con 7 días de anticipación.'
  },
  {
    id: 'glitter-bar-neon',
    title: 'Glitter Bar & Face Painting Neón UV',
    subtitle: 'Brillo y diversión asegurada en la tanda loca',
    category: 'efectos',
    categoryName: 'Efectos & Ambientación',
    price: 120000,
    priceFormatted: '$120.000',
    unit: 'por 2 horas de barra abierta',
    badge: '🎉 Fiesta Total',
    icon: 'palette',
    imageUrl: '/assets/complementos/glitter-bar-neon.jpg',
    shortDesc: 'Estación de maquillaje festivo con glitter biodegradable, gemas faciales, tattoos temporales y pinturas que brillan bajo luz negra.',
    description: 'Durante la apertura de la pista o la tanda de baile, maquilladoras profesionales lookean a los invitados con gemas, brillos y diseños neón para que la pista explote de color.',
    includes: [
      'Estación móvil con espejo iluminado tipo camerino',
      'Gemas corporales, perlas, strass y glitters hipoalergénicos',
      'Pinturas UV que brillan con luz negra + luz UV portátil',
      '2 maquilladoras caracterizadoras durante 2 horas continuas'
    ],
    requirements: 'Mesa o barra pequeña provista por el salón.',
    leadTime: 'Reserva con 7 días de anticipación.'
  }
];

// Helper functions for frontend and tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COMPLEMENTOS_DATA };
}
