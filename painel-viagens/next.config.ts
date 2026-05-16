/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Caso use imagens da internet no futuro, evitamos erros no export:
  images: { unoptimized: true } 
};

module.exports = nextConfig;

// OBS: Se o seu arquivo terminar com .mjs, a última linha deve ser:
// export default nextConfig;