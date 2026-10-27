/* Warn the viewer if the Three.js modules never arrive from the CDN */
setTimeout(function(){if(!window.__engineReady){var l=document.getElementById('loading');if(l){l.className='err';l.textContent='No se pudo cargar Three.js desde el CDN. Comprueba la conexión y recarga la página.';}}},20000);
