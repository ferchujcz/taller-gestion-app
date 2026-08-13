// Se ejecuta apenas intenta cargar la página
document.addEventListener("DOMContentLoaded", function() {
    // Buscamos la llave de acceso en la memoria del navegador
    const tokenAcceso = localStorage.getItem("token");
    
    // Si no hay llave, y no estamos ya en la pantalla de login, lo pateamos
    if (!tokenAcceso && !window.location.href.includes("login.html")) {
        console.warn("Acceso denegado. Redirigiendo al login...");
        window.location.href = "login.html"; 
    }
});

// INTERCEPTOR GLOBAL DE FETCH BLINDADO (Corregido para CORS)
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    // Solo le metemos la llave de seguridad si la petición va a nuestro propio backend (/api/...)
    if (typeof url === 'string' && url.startsWith('/api/')) {
        options.headers = options.headers || {};
        const token = localStorage.getItem("token");
        if (token) {
            options.headers["Authorization"] = `Bearer ${token}`;
        }
    }
    
    try {
        const response = await originalFetch(url, options);
        if (response.status === 401 && !window.location.href.includes("login.html")) {
            console.warn("Sesión expirada o no iniciada. Redirigiendo al login...");
            window.location.href = "login.html";
            return response;
        }
        return response;
    } catch (error) {
        throw error;
    }
};

// Función extra: Botón para Cerrar Sesión
function cerrarSesion() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

function mostrarNotificacion(mensaje, tipo = "info") {
    const contenedor = document.getElementById("contenedor-notificaciones");
    const toast = document.createElement("div");
    const colorBg = tipo === "error" ? "#ef4444" : (tipo === "exito" ? "#10b981" : "#3b82f6");
    toast.style.cssText = `background: ${colorBg}; color: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: bold; opacity: 0; transform: translateY(-20px); transition: all 0.3s ease;`;
    toast.innerHTML = mensaje;
    contenedor.appendChild(toast);
    
    // Animación de entrada
    setTimeout(() => { toast.style.opacity = "1"; toast.style.transform = "translateY(0)"; }, 10);
    // Destrucción luego de 4 segundos
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

    // ==========================================
    // VARIABLES GLOBALES PARA GRÁFICOS Y BUSCADORES
    // ==========================================
    let chartFinanzas = null;
    window.tallerConfigGlobal = { nombre: "Mi Taller", direccion: "", telefono: "" };
    window.clientesCRMGlobal = [];
    window.empleadosGlobal = [];
    window.todasLasMarcasGlobales = []; // Para el buscador inteligente

    // --- RUTEO MÓVIL AUTOMÁTICO (Sin spam en red) ---
    async function detectarVistasMoviles() { 
        const urlParams = new URLSearchParams(window.location.search); 
        const boxAsignado = urlParams.get('box'); 
        const esFichada = urlParams.get('fichar'); 
        const esTV = urlParams.get('tv'); 
        
        if (esTV) {
            document.getElementById('app-escritorio').style.display = 'none';
            document.getElementById('pantalla-tv').style.display = 'flex';
            iniciarModoTV();
            return;
        }
        if (boxAsignado) { 
            document.getElementById('app-escritorio').style.display = 'none'; 
            document.getElementById('pantalla-mecanico').style.display = 'flex'; 
            document.getElementById('mecanico_nombre_box').innerText = boxAsignado; 
            try { 
                const res = await fetch('/api/ordenes/'); 
                const ordenes = await res.json(); 
                const ordenEnEsteBox = ordenes.find(o => o.estado === 'En Box' && o.ubicacion === boxAsignado); 
                if (ordenEnEsteBox) { 
                    document.getElementById('mecanico_panel_espera').style.display = 'none'; 
                    document.getElementById('mecanico_panel_trabajo').style.display = 'block'; 
                    document.getElementById('mecanico_auto_trabajando').innerText = `${ordenEnEsteBox.patente} | ${ordenEnEsteBox.vehiculo_desc}`; 
                    document.getElementById('mecanico_orden_activa').value = ordenEnEsteBox.id; 
                    cargarItemsMecanico(ordenEnEsteBox.id);
                    cargarTareasDeMecanicoEnCelular(ordenEnEsteBox.id); 
                } else { 
                    document.getElementById('mecanico_panel_espera').style.display = 'block'; 
                    document.getElementById('mecanico_panel_trabajo').style.display = 'none'; 
                    const selectEspera = document.getElementById('mecanico_vehiculo_espera'); 
                    selectEspera.innerHTML = '<option value="">-- Seleccione el Vehículo --</option>'; 
                    let hayAutos = false; 
                    ordenes.forEach(o => { 
                        if (o.estado === 'Turno Asignado') { 
                            hayAutos = true; selectEspera.innerHTML += `<option value="${o.id}">${o.patente} | ${o.vehiculo_desc} (${o.falla || o.descripcion_falla || '-'})</option>`; 
                        } 
                    }); 
                    if(!hayAutos) selectEspera.innerHTML = '<option value="">(No hay autos en espera)</option>'; 
                } 
            } catch(e) {} 
        } else if (esFichada === 'true') { 
            document.getElementById('app-escritorio').style.display = 'none'; 
            document.getElementById('pantalla-fichada').style.display = 'flex'; 
        } else { 
            cargarCatalogoYBoxes(); cargarConfiguracion(); cargarDatosGlobales(); cargarMarcasDesdeAPI(); 
            // Eliminamos el setInterval ruidoso de 15 segundos
        } 
    }
    // --- SISTEMA DE CATÁLOGO Y BOXES ---
    let catalogoGlobal = []; let boxesGlobal = []; let indexEditandoCatalogo = -1;
    async function cargarCatalogoYBoxes() { try { const resC = await fetch('/api/gestion/catalogo'); if (resC.ok) catalogoGlobal = await resC.json(); renderizarCatalogoAdmin(); const resB = await fetch('/api/gestion/boxes'); if (resB.ok) boxesGlobal = await resB.json(); renderizarBoxesAdmin(); } catch(e) { console.warn("Catálogo/Boxes offline"); } }
    function renderizarCatalogoAdmin() { const tbody = document.getElementById('lista_catalogo_admin'); tbody.innerHTML = ''; if(catalogoGlobal.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:gray;">Agregue servicios al catálogo para empezar.</td></tr>'; return;} catalogoGlobal.forEach((serv, index) => { tbody.innerHTML += `<tr><td style="color:var(--text-muted);">${serv.categoria}</td><td style="font-weight:600;">${serv.nombre}</td><td style="text-align:right; font-weight:700;">$${serv.precio.toLocaleString('es-AR')}</td><td style="text-align:center; min-width: 80px;"><button onclick="iniciarEdicionCatalogo(${index})" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:1.2rem; margin-right:8px;"><i class="ph ph-pencil-simple"></i></button><button onclick="eliminarServicio(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.2rem;"><i class="ph ph-trash"></i></button></td></tr>`; }); actualizarSelectsDePresupuesto(); }
    function iniciarEdicionCatalogo(index) { const serv = catalogoGlobal[index]; document.getElementById('cat_categoria').value = serv.categoria; document.getElementById('cat_nombre').value = serv.nombre; document.getElementById('cat_precio').value = serv.precio; indexEditandoCatalogo = index; document.getElementById('btn_guardar_catalogo').innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar Cambios'; document.getElementById('btn_guardar_catalogo').classList.replace('btn-primary', 'btn-success'); document.getElementById('btn_cancelar_edicion').style.display = 'block'; document.getElementById('formCatalogoConfig').scrollIntoView({ behavior: 'smooth' }); }
    function cancelarEdicionCatalogo() { indexEditandoCatalogo = -1; document.getElementById('formCatalogoConfig').reset(); document.getElementById('btn_guardar_catalogo').innerHTML = '<i class="ph ph-plus"></i> Agregar Nuevo'; document.getElementById('btn_guardar_catalogo').classList.replace('btn-success', 'btn-primary'); document.getElementById('btn_cancelar_edicion').style.display = 'none'; }
    document.getElementById('formCatalogoConfig').addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const payload = { categoria: document.getElementById('cat_categoria').value, nombre: document.getElementById('cat_nombre').value, precio: parseFloat(document.getElementById('cat_precio').value) }; 
        try { 
            let res;
            if (indexEditandoCatalogo >= 0) { 
                const idServicio = catalogoGlobal[indexEditandoCatalogo].id; 
                res = await fetch(`/api/gestion/catalogo/${idServicio}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); 
            } else { 
                res = await fetch(`/api/gestion/catalogo`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); 
            } 
            if (!res.ok) throw new Error(await res.text());
            cancelarEdicionCatalogo(); 
            cargarCatalogoYBoxes(); 
        } catch(e) { mostrarNotificacion("Error al guardar: " + e.message, "error"); } 
    });
    async function eliminarServicio(index) { if(confirm("¿Seguro que desea eliminar este servicio?")) { try { const idServicio = catalogoGlobal[index].id; await fetch(`/api/gestion/catalogo/${idServicio}`, { method: 'DELETE' }); cargarCatalogoYBoxes(); } catch(e) {} } }
    function actualizarSelectsDePresupuesto() { const selects = [document.getElementById('select_catalogo'), document.getElementById('select_catalogo_rapido')]; const agrupado = {}; catalogoGlobal.forEach(s => { if(!agrupado[s.categoria]) agrupado[s.categoria] = []; agrupado[s.categoria].push(s); }); selects.forEach(select => { if(!select) return; select.innerHTML = '<option value="">-- Seleccionar o Escribir Manual --</option>'; for (const [cat, servs] of Object.entries(agrupado)) { let optgroup = document.createElement('optgroup'); optgroup.label = cat; servs.forEach(s => { let opt = document.createElement('option'); opt.value = JSON.stringify(s); opt.textContent = `${s.nombre} - $${s.precio.toLocaleString('es-AR')}`; optgroup.appendChild(opt); }); select.appendChild(optgroup); } }); }

    function renderizarBoxesAdmin() { const tbody = document.getElementById('lista_boxes_admin'); tbody.innerHTML = ''; if(boxesGlobal.length===0){ tbody.innerHTML = '<tr><td colspan=\"2\" style=\"text-align:center; color:gray;\">Agregue un Box para generar QRs.</td></tr>'; return; } boxesGlobal.forEach((box, index) => { tbody.innerHTML += `<tr><td style=\"font-weight:700; font-size:1.1rem; color:var(--dark);\"><i class=\"ph ph-garage\" style=\"color:var(--primary);\"></i> ${box.nombre}</td><td style=\"text-align:center;\"><button onclick=\"abrirModalQRBox('${box.nombre}')\" class=\"btn-outline\" style=\"padding:8px 12px; margin-right:10px;\"><i class=\"ph ph-qr-code\"></i> QR</button><button onclick=\"eliminarBox(${index})\" style=\"background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.2rem;\"><i class=\"ph ph-trash\"></i></button></td></tr>`; }); }
    document.getElementById('formBoxesConfig').addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        try { 
            const res = await fetch(`/api/gestion/boxes`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nombre: document.getElementById('box_nombre_crear').value }) }); 
            if (!res.ok) throw new Error(await res.text());
            document.getElementById('formBoxesConfig').reset(); 
            cargarCatalogoYBoxes(); 
            cargarTablero(); 
        } catch(e) { mostrarNotificacion("Error al guardar Box: " + e.message, "error"); } 
    });
    async function eliminarBox(index) { try{ const idBox = boxesGlobal[index].id; await fetch(`/api/gestion/boxes/${idBox}`, { method: 'DELETE' }); cargarCatalogoYBoxes(); cargarTablero(); } catch(e){} }
    
    // --- GENERADOR DE QRs INTELIGENTE ---
    let qrCodeActual = null; 
    function abrirModalQRBox(nombreBox) { document.getElementById('qr_titulo_modal').innerText = "Cartel QR del Box"; document.getElementById('nombre_box_imprimir').innerText = nombreBox; document.getElementById('qr_tipo_impresion').value = "BOX"; const contenedor = document.getElementById('contenedor-codigo-qr'); contenedor.innerHTML = ''; const urlReal = window.location.origin + "/?box=" + encodeURIComponent(nombreBox); qrCodeActual = new QRCode(contenedor, { text: urlReal, width: 250, height: 250, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H }); document.getElementById('modal-imprimir-qr').style.display = 'flex'; }
    function abrirModalQRGeneral() { document.getElementById('qr_titulo_modal').innerText = "QR Asistencia Personal"; document.getElementById('nombre_box_imprimir').innerText = "La Puerta de Entrada del Taller"; document.getElementById('qr_tipo_impresion').value = "ASISTENCIA"; const contenedor = document.getElementById('contenedor-codigo-qr'); contenedor.innerHTML = ''; const urlReal = window.location.origin + "/?fichar=true"; qrCodeActual = new QRCode(contenedor, { text: urlReal, width: 250, height: 250, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H }); document.getElementById('modal-imprimir-qr').style.display = 'flex'; }
    function imprimirCartelQR() { const tipo = document.getElementById('qr_tipo_impresion').value; const nombre = document.getElementById('nombre_box_imprimir').innerText; const imgBase64 = document.querySelector('#contenedor-codigo-qr img').src; let htmlCartel = ""; if (tipo === "BOX") { htmlCartel = `<!DOCTYPE html><html><head><title>QR Box</title><style>body { font-family: 'Helvetica', sans-serif; text-align: center; margin: 0; padding: 50px; } h1 { font-size: 60px; color: #000; text-transform: uppercase; margin-bottom: 10px;} h2 { font-size: 30px; color: #dc2626; margin-bottom: 50px;} img { width: 500px; height: 500px; border: 10px solid #000; padding: 20px; border-radius: 20px;} p { font-size: 24px; color: gray; margin-top: 50px;}</style></head><body><h1>${nombre}</h1><h2>3D RACER - ÁREA DE TRABAJO</h2><img src="${imgBase64}"><p>MECÁNICO: ESCANEE ESTE CÓDIGO CON SU CELULAR PARA INGRESAR EL VEHÍCULO A ESTE BOX</p><script>window.onload=function(){window.print();};window.onafterprint=function(){window.close();};<\/script></body></html>`; } else { htmlCartel = `<!DOCTYPE html><html><head><title>QR Asistencia</title><style>body { font-family: 'Helvetica', sans-serif; text-align: center; margin: 0; padding: 50px; } h1 { font-size: 60px; color: #000; text-transform: uppercase; margin-bottom: 10px;} h2 { font-size: 30px; color: #dc2626; margin-bottom: 50px;} img { width: 500px; height: 500px; border: 10px solid #000; padding: 20px; border-radius: 20px;} p { font-size: 24px; color: gray; margin-top: 50px;}</style></head><body><h1>CONTROL DE ASISTENCIA</h1><h2>TALLER 3D RACER</h2><img src="${imgBase64}"><p>PERSONAL: ESCANEE ESTE CÓDIGO CON SU CELULAR AL INGRESAR Y AL RETIRARSE</p><script>window.onload=function(){window.print();};window.onafterprint=function(){window.close();};<\/script></body></html>`; } const ventana = window.open('', '_blank'); ventana.document.write(htmlCartel); ventana.document.close(); document.getElementById('modal-imprimir-qr').style.display = 'none'; }

    // --- CRM Y CLINICO MEJORADO ---
    async function cargarClientesCRM() { try { const res = await fetch('/api/clientes/'); if(!res.ok) throw new Error(); window.clientesCRMGlobal = await res.json(); renderizarListaCRM(window.clientesCRMGlobal); } catch(e) { console.error("Error CRM."); } }
    function filtrarCRM() { const texto = document.getElementById('buscador_crm').value.toLowerCase(); if(!window.clientesCRMGlobal) return; const filtrados = window.clientesCRMGlobal.filter(c => c.nombre.toLowerCase().includes(texto) || (c.telefono && c.telefono.toLowerCase().includes(texto)) ); renderizarListaCRM(filtrados); }
    function renderizarListaCRM(lista) { 
    const tbody = document.getElementById('lista_clientes_crm'); 
    tbody.innerHTML = ''; 
    if(lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:gray; padding: 20px;">No se encontraron clientes.</td></tr>'; 
        return; 
    } 
    lista.forEach(c => { 
        // Lógica visual para deudores
        let htmlDeuda = '';
        if (c.saldo_deuda > 0) {
            htmlDeuda = `<br><span class="badge-deuda">⚠️ DEBE: $${c.saldo_deuda.toLocaleString('es-AR')}</span>`;
        }
        
        tbody.innerHTML += `<tr>
            <td><strong>${c.nombre}</strong><br><span style="color:gray; font-size:0.8rem;">Tel: ${c.telefono||'N/A'}</span>${htmlDeuda}</td>
            <td style="text-align:right;">
                <button class="btn-dark" style="padding: 5px 15px;" onclick="verHistorialCliente(${c.id}, '${c.nombre}', ${c.saldo_deuda || 0})"><i class="ph ph-file-search"></i> Ver Ficha</button>
            </td>
        </tr>`; 
    }); 
    }
    async function verHistorialCliente(idCliente, nombreCliente, saldo_deuda = 0) { 
        document.getElementById('crm_nombre_cliente').innerText = nombreCliente; 
        const divHistorial = document.getElementById('crm_historial_datos'); 
        divHistorial.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i></div>'; 
        
        try { 
            const resV = await fetch('/api/vehiculos/'); 
            const vehiculos = await resV.json(); 
            const misVehiculos = vehiculos.filter(v => parseInt(v.cliente_id) === parseInt(idCliente)); 
            
            const resO = await fetch('/api/ordenes/'); 
            const ordenes = await resO.json(); 
            
            // --- CARTEL ROJO SI DEBE PLATA ---
            let headerDeuda = '';
            if(saldo_deuda > 0) {
                headerDeuda = `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div><strong style="color: var(--danger); font-size: 1.2rem;">DEUDA PENDIENTE: $${saldo_deuda.toLocaleString('es-AR')}</strong><br><span style="color: gray; font-size: 0.85rem;">Monto acumulado por fiado.</span></div>
                    <button class="btn-success" style="padding: 10px 20px;" onclick="abrirModalPagoDeuda(${idCliente}, '${nombreCliente}', ${saldo_deuda})"><i class="ph ph-money"></i> Cobrar Ahora</button>
                </div>`;
            }

            divHistorial.innerHTML = headerDeuda; 
            
            if(misVehiculos.length === 0) { 
                divHistorial.innerHTML += '<p style="text-align:center; color:gray; padding:20px;">Este cliente no tiene vehículos registrados.</p>'; 
                return; 
            } 
            
            // ... (ACÁ SIGUE TU CÓDIGO NORMAL DEL FOR PARA PINTAR LOS VEHÍCULOS) ...
            for (const v of misVehiculos) { 
                let html = `<div style="background: white; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 20px; overflow: hidden;"><div style="background: var(--dark); color: white; padding: 12px 20px; font-weight: 700; display:flex; justify-content:space-between;"><span>${v.marca} ${v.modelo}</span> <span>Patente: <span style="color:var(--primary);">${v.patente}</span></span></div><ul style="list-style:none; padding:0; margin:0;">`; 
                
                const misOrdenes = ordenes.filter(o => parseInt(o.vehiculo_id) === parseInt(v.id)); 
                
                if(misOrdenes.length === 0) {
                    html += `<li style="padding: 15px; color: gray; text-align: center;">Sin ingresos al taller aún.</li>`; 
                } else {
                    for (const o of misOrdenes) { 
                        const descripcion_falla = o.falla || o.descripcion_falla || 'Sin detalles registrados';
                        const colorEst = o.estado === 'Entregado' ? 'color:var(--primary);' : (o.estado === 'Terminado' ? 'color:var(--success);' : 'color:var(--warning);'); 
                        const fechaFormateada = o.fecha_ingreso ? new Date(o.fecha_ingreso).toLocaleDateString('es-AR') : 'Fecha Desconocida';
                        
                        let listaTrabajos = "";
                        try {
                            const resDetalles = await fetch(`/api/ordenes/${o.id}/detalles`);
                            const detalles = await resDetalles.json();
                            if(detalles.length > 0) {
                                listaTrabajos = `<ul style="margin-top: 10px; padding-left: 20px; font-size: 0.9rem; color: var(--text-muted);">`;
                                detalles.forEach(d => {
                                    listaTrabajos += `<li><strong style="color:var(--text-main);">${d.cantidad}x</strong> ${d.descripcion}</li>`;
                                });
                                listaTrabajos += `</ul>`;
                            } else {
                                listaTrabajos = `<p style="margin-top: 10px; font-size: 0.85rem; color: gray; font-style: italic;">Sin trabajos anotados en el presupuesto.</p>`;
                            }
                        } catch(e) {}
                        
                        html += `<li style="padding: 15px; border-bottom: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:center;">
                            <div style="display:flex; justify-content:space-between; width:100%;">
                                <div><strong style="color:var(--text-main);">${descripcion_falla}</strong><br><span style="font-size:0.85rem; color:gray;">Fecha ingreso: ${fechaFormateada}</span></div>
                                <div style="font-weight:700; ${colorEst}">${o.estado}</div>
                            </div>
                            ${listaTrabajos}
                        </li>`; 
                    }
                }
                html += `</ul></div>`; 
                divHistorial.innerHTML += html; 
            } 
        } catch(e) { 
            divHistorial.innerHTML = '<p style="padding:20px; color:red; text-align:center;">Error cargando historial.</p>'; 
        } 
    }

    // --- FLUJO DEL MECANICO ---
    async function mecanicoIngresarVehiculo() { const idOrden = document.getElementById('mecanico_vehiculo_espera').value; const nombreBox = document.getElementById('mecanico_nombre_box').innerText; if(!idOrden) { mostrarNotificacion("Seleccione un vehículo.", "error"); return; } try { await fetch(`/api/ordenes/${idOrden}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ estado: 'En Box', ubicacion: nombreBox }) }); detectarVistasMoviles(); } catch(e) {} }
    async function mecanicoAgregarRepuesto() { 
        const idOrden = document.getElementById('mecanico_orden_activa').value; 
        const tipo = document.getElementById('mec_item_tipo').value;
        const desc = document.getElementById('mec_item_desc').value; 
        const cant = parseInt(document.getElementById('mec_item_cant').value) || 1; 
        const notas = document.getElementById('mec_item_notas').value;
        
        if(!desc) { mostrarNotificacion("Debe escribir una descripción.", "error"); return; }
        
        const prefijo = tipo === 'REPUESTO' ? '📦 [Repuesto]' : '🔧 [Mano de Obra]';
        const descripcionFinal = notas ? `${prefijo} ${desc} (Notas: ${notas})` : `${prefijo} ${desc}`;
        
        try {
            // 1. Guardar en el presupuesto de la orden
            await fetch(`/api/ordenes/${idOrden}/detalles`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ descripcion: descripcionFinal, cantidad: cant, precio_unitario: 0 }) 
            }); 

            // 2. Si es REPUESTO, intentamos descontarlo del inventario
            if (tipo === 'REPUESTO') {
                const itemInv = inventarioGlobal.find(inv => inv.nombre.toLowerCase() === desc.toLowerCase());
                if (itemInv) {
                    // Llama a la ruta con el parámetro ?cantidad=X
                    await fetch(`/api/inventario/${itemInv.id}/descontar?cantidad=${cant}`, { method: 'PUT', headers: {'Content-Type': 'application/json'} });
                }
            }

            document.getElementById('mec_item_desc').value = ''; 
            document.getElementById('mec_item_cant').value = '1'; 
            document.getElementById('mec_item_notas').value = ''; 
            cargarItemsMecanico(idOrden); 
            mostrarNotificacion("Agregado a la orden", "exito");
        } catch(e) { mostrarNotificacion("Error al cargar el ítem.", "error"); }
    }
    async function cargarItemsMecanico(id_orden) { const res = await fetch(`/api/ordenes/${id_orden}/detalles`); const det = await res.json(); const lista = document.getElementById('mecanico_lista_items'); lista.innerHTML = ''; if(det.length === 0) lista.innerHTML = '<p style=\"color:gray; font-size:0.9rem;\">Sin trabajos anotados aún.</p>'; det.forEach(i => { lista.innerHTML += `<div class=\"mec-item\"><div class=\"mec-item-header\"><span>${i.descripcion}</span><span style=\"color:var(--primary);\">x${i.cantidad}</span></div></div>`; }); }
    async function mecanicoTerminarTrabajo() { const idOrden = document.getElementById('mecanico_orden_activa').value; if(confirm("¿Seguro que terminaste de trabajar en este auto? Se sacará del box.")) { await fetch(`/api/ordenes/${idOrden}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ estado: 'Terminado', ubicacion: 'Playa' }) }); mostrarNotificacion("Trabajo Terminado. El administrador fue notificado.", "exito"); detectarVistasMoviles(); } }

    // --- SISTEMA INSTITUCIONAL E INICIO ---
    let logoBase64Actual = null; let ordenActualParaPDF = null; let latamCarsDB = null; let claveMarcaDetectada = ""; let claveModeloDetectada = ""; let vehiculosLocales = [];
    function cerrarBienvenida() { document.getElementById('splash-screen').style.opacity = '0'; setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 500); }
    function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('modo_oscuro', document.body.classList.contains('dark-mode')); if(chartFinanzas) chartFinanzas.update(); }
    if (localStorage.getItem('modo_oscuro') === 'true') document.body.classList.add('dark-mode');
    document.getElementById('input_logo').addEventListener('change', function(e) { const archivo = e.target.files[0]; if (archivo) { const reader = new FileReader(); reader.onload = function(ev) { logoBase64Actual = ev.target.result; document.getElementById('preview_logo').src = logoBase64Actual; document.getElementById('preview_logo').style.display = 'block'; }; reader.readAsDataURL(archivo); } });

   async function cargarConfiguracion() { 
        try { 
            const res = await fetch('/api/configuracion/'); 
            if(!res.ok) return; 
            const config = await res.json(); 
            if (!config || Object.keys(config).length === 0) return; 
            
            // Guardamos en la memoria global para los PDF
            window.tallerConfigGlobal.nombre = config.nombre_taller || "";
            window.tallerConfigGlobal.direccion = config.direccion || "";
            window.tallerConfigGlobal.telefono = config.telefono || "";
            
            const nombreTaller = config.nombre_taller || "Nombre No Configurado"; 
            
            // Rellenamos los inputs visuales
            document.getElementById('conf_nombre').value = config.nombre_taller || ''; 
            document.getElementById('conf_direccion').value = config.direccion || ''; 
            document.getElementById('conf_telefono').value = config.telefono || ''; 
            document.getElementById('conf_email').value = config.email || ''; 
            document.getElementById('menu-nombre-taller').innerText = nombreTaller; 
            document.getElementById('titulo-pestana').innerText = nombreTaller + " | Gestión"; 
            
            if (config.logo_b64) { 
                logoBase64Actual = config.logo_b64; 
                document.getElementById('preview_logo').src = config.logo_b64; 
                document.getElementById('preview_logo').style.display = 'block'; 
                document.getElementById('menu-logo').src = config.logo_b64; 
                document.getElementById('menu-logo').style.display = 'block'; 
            } 
        } catch(e) { console.warn("Aún no hay configuración guardada."); } 
    }

    async function guardarConfiguracion() { 
        try { 
            const datos = { nombre_taller: document.getElementById('conf_nombre').value, direccion: document.getElementById('conf_direccion').value, telefono: document.getElementById('conf_telefono').value, email: document.getElementById('conf_email').value, logo_b64: logoBase64Actual }; 
            const res = await fetch('/api/configuracion/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }); 
            if (!res.ok) throw new Error(await res.text());
            mostrarNotificacion("✅ ¡Configuración Institucional guardada!", "exito"); 
            cargarConfiguracion(); 
        } catch (e) { mostrarNotificacion("Error al guardar la configuración: " + e.message, "error");} 
    }

    async function cargarDatosGlobales() {
        try {
            const token = localStorage.getItem("token");
            if (!token) throw new Error("Sin sesión activa");

            // El interceptor global ya adjunta el token a esta llamada
            const resC = await fetch('/api/clientes/'); 
            
            // Si el servidor rechaza la conexión (ej: base de datos borrada)
            if (!resC.ok) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }
            
            const clientes = await resC.json(); 
            document.getElementById('cliente_id').innerHTML = '<option value="">Seleccione...</option>'; 
            clientes.forEach(c => document.getElementById('cliente_id').innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
            
            const resV = await fetch('/api/vehiculos/'); 
            const vehiculos = await resV.json();
            vehiculosLocales = vehiculos; 
            actualizarListaMarcas();      
            
            document.getElementById('vehiculo_orden').innerHTML = '<option value="">Seleccione...</option>'; 
            vehiculos.forEach(v => document.getElementById('vehiculo_orden').innerHTML += `<option value="${v.id}">${v.patente} - ${v.marca} ${v.modelo}</option>`);
            
            cargarTablero(); 
            cargarCaja(); 
            cargarEmpleados(); 
            cargarPresentesDashboard();
            if(typeof cargarInventario === 'function') cargarInventario();

        } catch(e) { 
            console.warn("Sesión inválida. Redirigiendo al login..."); 
            localStorage.removeItem("token");
            window.location.href = "login.html";
        }
    }
    async function cargarTablero() {
        try {
            const res = await fetch('/api/ordenes/'); if(!res.ok) return; const ordenes = await res.json();
            document.getElementById('col_espera').innerHTML = ''; document.getElementById('col_box').innerHTML = ''; document.getElementById('col_terminado').innerHTML = '';
            let cEspera = 0, cBox = 0, cTerm = 0; let opcionesBox = ""; boxesGlobal.forEach(b => { opcionesBox += `<option value="${b.nombre}">${b.nombre}</option>`; });
            let autosDelMes = 0; const mesActual = new Date().getMonth();

            ordenes.forEach(orden => {
                const fechaOrden = new Date(orden.fecha_ingreso || Date.now());
                if (fechaOrden.getMonth() === mesActual) autosDelMes++;

                if(orden.estado === 'Entregado') return; 
                
                let html = `<div class=\"tarjeta-orden\"><h5 style=\"margin: 0 0 10px 0; color: var(--dark); font-size: 1.1rem;\">${orden.patente} | ${orden.vehiculo_desc}</h5><p style=\"margin-bottom: 15px;\"><i class=\"ph ph-warning-circle\"></i> ${orden.falla || orden.descripcion_falla || 'Sin detalles'}</p><button class=\"btn-outline\" style=\"width: 100%; margin-bottom: 15px; border-color: var(--primary); color: var(--primary); font-weight: 600;\" onclick='abrirModalPresupuesto(${JSON.stringify(orden)})'><i class=\"ph ph-file-text\" style=\"font-size: 1.2rem;\"></i> Presupuesto Oficial</button><hr style=\"border: 0; border-top: 1px dashed var(--border-color); margin: 0 0 15px 0;\">`;
                if (orden.estado === 'Turno Asignado') { cEspera++; html += `<div style=\"display: flex; gap: 8px;\"><select id=\"sel_box_${orden.id}\" style=\"margin:0; padding:8px; flex: 1.5;\">${opcionesBox}</select><button class=\"btn-dark\" style=\"padding: 8px; flex: 1;\" onclick=\"moverOrden(${orden.id}, 'En Box')\"><i class=\"ph ph-arrow-right\"></i></button></div></div>`; document.getElementById('col_espera').innerHTML += html; } 
                else if (orden.estado === 'En Box') { cBox++; html += `<button class=\"btn-success\" style=\"width:100%; padding:10px;\" onclick=\"moverOrden(${orden.id}, 'Terminado', 'Playa')\"><i class=\"ph ph-check-circle\"></i> Terminar Trabajo</button></div>`; document.getElementById('col_box').innerHTML += html; } 
                else if (orden.estado === 'Terminado') { cTerm++; html += `<button class=\"btn-success\" style=\"width:100%; padding:10px; background-color: var(--dark);\" onclick=\"abrirModalCobrar(${orden.id}, '${orden.patente}')\"><i class=\"ph ph-currency-circle-dollar\"></i> Cobrar y Entregar</button></div>`; document.getElementById('col_terminado').innerHTML += html; }
            });
            
            document.getElementById('dash-espera').innerText = cEspera; document.getElementById('dash-box').innerText = cBox; document.getElementById('dash-terminados').innerText = cTerm; document.getElementById('dash-autos-mes').innerText = autosDelMes;
        } catch(e){}
        calcularMetricasAvanzadas();
    }
    // Captura el valor del botón de combustible seleccionado
    function guardarIngresoConCombustible() {
        const seleccion = document.querySelector('input[name="nivel_comb"]:checked').value;
        document.getElementById('rec_combustible').value = seleccion;
        
        // Llama a tu función original
        guardarIngreso(); 
    }
    // 2. CORRECCIÓN DEL AÑO NULL EN LA RECEPCIÓN
    async function guardarIngreso() { 
        try {
            let id_dueno = document.getElementById('cliente_id').value; 
            const nuevo_nombre = document.getElementById('nuevo_nombre').value; 
            if (!id_dueno && nuevo_nombre) { 
                const resC = await fetch('/api/clientes/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nombre: nuevo_nombre, telefono: document.getElementById('nuevo_telefono').value})}); 
                if (!resC.ok) throw new Error("Error al crear el nuevo cliente.");
                const cliente = await resC.json(); 
                id_dueno = cliente.id; 
            } 
            if (!id_dueno) { mostrarNotificacion("⚠️ Debe seleccionar un Cliente Existente o escribir uno Nuevo.", "error"); return; } 
            
            const anioForm = document.getElementById('anio').value; 
            const anioValidado = anioForm ? parseInt(anioForm) : 0; // Evita el error Null enviando un 0 si está vacío

            const resV = await fetch('/api/vehiculos/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ patente: document.getElementById('patente').value.toUpperCase(), marca: document.getElementById('recepcion_marca').value, modelo: document.getElementById('recepcion_modelo').value, anio: anioValidado, cliente_id: parseInt(id_dueno)}) }); 
            if (!resV.ok) throw new Error(await resV.text());
            
            document.getElementById('formVehiculo').reset(); 
            cargarDatosGlobales(); 
            mostrarNotificacion("✅ Vehículo ingresado correctamente a Recepción.", "exito"); 
        } catch(e) { mostrarNotificacion("Error al guardar vehículo", "error"); }
    }

    document.getElementById('formOrden').addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        try {
            // Leemos los valores del checklist
            const combustible = document.getElementById('rec_combustible').value;
            const detalles = document.getElementById('rec_detalles').value;

            const res = await fetch('/api/ordenes/', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ 
                    vehiculo_id: parseInt(document.getElementById('vehiculo_orden').value), 
                    descripcion_falla: document.getElementById('falla_orden').value,
                    nivel_combustible: combustible,
                    detalles_ingreso: detalles
                }) 
            }); 
            if (!res.ok) throw new Error(await res.text());
            document.getElementById('formOrden').reset(); 
            document.getElementById('rec_detalles').value = ''; // Limpiar campo
            mostrarNotificacion("✅ Turno generado correctamente con su Checklist. Puede verlo en Espera.", "exito");
            cargarTablero(); 
        } catch(e) { mostrarNotificacion("Error al generar Orden: " + e.message, "error"); }
    });
    async function moverOrden(id_orden, estado, ubi = null) { let ubicacion = ubi || document.getElementById(`sel_box_${id_orden}`).value; await fetch(`/api/ordenes/${id_orden}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ estado: estado, ubicacion: ubicacion }) }); cargarTablero(); }

    // 1. EL PARACAÍDAS PARA LAS MARCAS MEJORADO
    async function cargarMarcasDesdeAPI() { 
        try { 
            // Usamos la red jsDelivr para saltar el bloqueo CORS de GitHub
            const res = await fetch('https://cdn.jsdelivr.net/gh/BayronDavid/latam-vehicle-db@main/vehicles_cars.json'); 
            if(!res.ok) throw new Error("CORS o error de red");
            latamCarsDB = await res.json(); 
            if (Array.isArray(latamCarsDB) && latamCarsDB.length > 0) { 
                const claves = Object.keys(latamCarsDB[0]); 
                claveMarcaDetectada = claves.find(k => k.toLowerCase().includes('marc') || k.toLowerCase().includes('mak') || k.toLowerCase().includes('bran')) || claves[0]; 
                claveModeloDetectada = claves.find(k => k.toLowerCase().includes('model') || k.toLowerCase().includes('mod')) || claves[1]; 
            } 
        } catch (e) { 
            console.warn("Usando base de marcas local de respaldo.");
            // Respaldo corporativo con modelos incluidos para que nunca falle
            latamCarsDB = [
                {marca: "Volkswagen", modelo: "Amarok"}, {marca: "Volkswagen", modelo: "Gol"}, {marca: "Volkswagen", modelo: "Vento"},
                {marca: "Ford", modelo: "Ranger"}, {marca: "Ford", modelo: "Fiesta"}, {marca: "Ford", modelo: "Focus"},
                {marca: "Chevrolet", modelo: "S10"}, {marca: "Chevrolet", modelo: "Cruze"}, {marca: "Chevrolet", modelo: "Onix"},
                {marca: "Toyota", modelo: "Hilux"}, {marca: "Toyota", modelo: "Corolla"}, {marca: "Toyota", modelo: "Etios"},
                {marca: "Fiat", modelo: "Cronos"}, {marca: "Fiat", modelo: "Toro"}, {marca: "Fiat", modelo: "Argo"},
                {marca: "Peugeot", modelo: "208"}, {marca: "Peugeot", modelo: "308"},
                {marca: "Renault", modelo: "Kangoo"}, {marca: "Renault", modelo: "Clio"}
            ];
            claveMarcaDetectada = "marca";
            claveModeloDetectada = "modelo";
        } 
        actualizarListaMarcas(); 
    }
    function actualizarListaMarcas() { 
        let marcasUnicas = new Set(); 
        if (latamCarsDB) { 
            if (!Array.isArray(latamCarsDB) && typeof latamCarsDB === 'object') { 
                Object.keys(latamCarsDB).forEach(m => marcasUnicas.add(m.trim().toUpperCase())); 
            } else if (Array.isArray(latamCarsDB)) { 
                latamCarsDB.forEach(auto => { if (auto[claveMarcaDetectada]) marcasUnicas.add(String(auto[claveMarcaDetectada]).trim().toUpperCase()); }); 
            } 
        } 
        vehiculosLocales.forEach(v => { if (v.marca) marcasUnicas.add(v.marca.trim().toUpperCase()); }); 
        window.todasLasMarcasGlobales = [...marcasUnicas].sort();
    }

    // Esta funcion solo inyecta opciones al datalist cuando escribís 2 letras o más
    function buscarMarcasDinamico(texto, idDatalistDestino) {
        const lista = document.getElementById(idDatalistDestino);
        lista.innerHTML = '';
        if(texto.length < 2) return;
        const filtro = texto.toUpperCase();
        const coincidencias = window.todasLasMarcasGlobales.filter(m => m.includes(filtro)).slice(0, 10);
        coincidencias.forEach(m => {
            lista.innerHTML += `<option value="${m.charAt(0) + m.slice(1).toLowerCase()}"></option>`;
        });
    }
    
    function buscarModelos(marcaIngresada, idDatalistDestino) { 
        const marcaElegida = marcaIngresada.trim().toUpperCase(); 
        const listaModelos = document.getElementById(idDatalistDestino); if (!listaModelos) return; 
        listaModelos.innerHTML = ''; if (!marcaElegida) return; 
        let modelosUnicos = new Set(); 
        if (latamCarsDB) { 
            if (!Array.isArray(latamCarsDB)) { 
                const claveReal = Object.keys(latamCarsDB).find(k => k.toUpperCase() === marcaElegida); 
                if (claveReal && Array.isArray(latamCarsDB[claveReal])) { 
                    latamCarsDB[claveReal].forEach(m => { const mod = typeof m === 'object' ? (m.model || m.modelo || m.name || JSON.stringify(m)) : m; if (mod) modelosUnicos.add(String(mod).trim().toUpperCase()); }); 
                } 
            } else if (Array.isArray(latamCarsDB)) { 
                latamCarsDB.forEach(auto => { 
                    const m = String(auto[claveMarcaDetectada] || "").trim().toUpperCase(); 
                    if (m === marcaElegida && auto[claveModeloDetectada]) { modelosUnicos.add(String(auto[claveModeloDetectada]).trim().toUpperCase()); } 
                }); 
            } 
        } 
        vehiculosLocales.forEach(v => { if (v.marca && v.marca.trim().toUpperCase() === marcaElegida && v.modelo) { modelosUnicos.add(v.modelo.trim().toUpperCase()); } }); 
        
        [...modelosUnicos].sort().slice(0, 15).forEach(modelo => { 
            listaModelos.innerHTML += `<option value="${modelo.charAt(0) + modelo.slice(1).toLowerCase()}"></option>`; 
        }); 
    }
    
        // LOGICA DE PATENTES AMPLIADA
    function calcularAnoPorPatente() { 
        let patente = document.getElementById('patente').value.trim().toUpperCase().replace(/[- ]/g, ''); 
        let inputAnio = document.getElementById('anio'); 
        if (inputAnio.value !== "") return; 
        let ano = ""; 
        
        // Formato viejo: 3 letras + 3 números (XXX 000)
        if (patente.length === 6 && /^[A-Z]{3}\d{3}$/.test(patente)) {
            const l = patente.substring(0, 3);
            if (l >= 'OAA') ano = 2015; else if (l >= 'NAA') ano = 2014; else if (l >= 'MAA') ano = 2013; else if (l >= 'LAA') ano = 2012; else if (l >= 'KAA') ano = 2011; else if (l >= 'JAA') ano = 2010; else if (l >= 'IAA') ano = 2009; else if (l >= 'HAA') ano = 2008; else if (l >= 'GAA') ano = 2007; else if (l >= 'FAA') ano = 2006; else if (l >= 'EAA') ano = 2004; else if (l >= 'DAA') ano = 2000; else if (l >= 'CAA') ano = 1998; else if (l >= 'BAA') ano = 1996; else if (l >= 'AAA') ano = 1995;
        } 
        // Formato Mercosur: 2 letras + 3 números + 2 letras (AA 000 AA)
        else if (patente.length === 7) { 
            const l = patente.substring(0, 2); 
            if (l >= 'AI') ano = 2025; else if (l >= 'AH') ano = 2024; else if (l >= 'AG') ano = 2023; else if (l >= 'AF') ano = 2022; else if (l >= 'AE') ano = 2020; else if (l >= 'AD') ano = 2019; else if (l >= 'AC') ano = 2018; else if (l >= 'AB') ano = 2017; else if (l >= 'AA') ano = 2016; 
        } 
        if (ano !== "") inputAnio.value = ano; 
    }
    // --- DASHBOARD GRÁFICOS Y ANALÍTICA ---
    function renderizarGraficoFinanzas(ingresosTotales, egresosTotales) {
        const ctx = document.getElementById('chartFinanzas').getContext('2d');
        if(chartFinanzas) chartFinanzas.destroy();
        const textColor = document.body.classList.contains('dark-mode') ? '#f4f4f5' : '#18181b';
        const gridColor = document.body.classList.contains('dark-mode') ? '#27272a' : '#e4e4e7';
        chartFinanzas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ingresos (+)', 'Egresos (-)'],
                datasets: [{ label: 'Monto ($)', data: [ingresosTotales, egresosTotales], backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'], borderColor: ['#10b981', '#ef4444'], borderWidth: 1, borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: textColor, callback: function(value) { return '$' + value.toLocaleString('es-AR'); } }, grid: { color: gridColor } }, x: { ticks: { color: textColor }, grid: { display: false } } } }
        });
    }

    // --- EMPLEADOS (CRUD BÁSICO UI) ---
    document.getElementById('formEmpleado').addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const idEditar = document.getElementById('emp_id_editar').value;
        const payload = { nombre: document.getElementById('emp_nombre').value, documento: document.getElementById('emp_doc').value, puesto: document.getElementById('emp_puesto').value };
        try {
            let res;
            if (idEditar) {
                res = await fetch(`/api/empleados/${idEditar}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); 
                if(!res.ok) throw new Error(await res.text());
                mostrarNotificacion("✅ Empleado actualizado.", "exito");
            } else {
                res = await fetch('/api/empleados/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); 
                if(!res.ok) throw new Error("Posiblemente el DNI ya exista o falten datos.");
                mostrarNotificacion("✅ Empleado creado.", "exito");
            }
            cancelarEdicionEmpleado(); 
            cargarEmpleados();
        } catch(e){ mostrarNotificacion("Error al guardar empleado: " + e.message, "error"); }
    });

    function iniciarEdicionEmpleado(id, nombre, doc, puesto) { document.getElementById('emp_id_editar').value = id; document.getElementById('emp_nombre').value = nombre; document.getElementById('emp_doc').value = doc; document.getElementById('emp_puesto').value = puesto; document.getElementById('btn_guardar_emp').innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar Cambios'; document.getElementById('btn_cancelar_emp').style.display = 'block'; document.getElementById('formEmpleado').scrollIntoView({ behavior: 'smooth' }); }
    function cancelarEdicionEmpleado() { document.getElementById('emp_id_editar').value = ''; document.getElementById('formEmpleado').reset(); document.getElementById('btn_guardar_emp').innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar Empleado'; document.getElementById('btn_cancelar_emp').style.display = 'none'; }
    async function eliminarEmpleadoLocal(id) { if(confirm("¿Seguro que desea eliminar a este empleado?")) { try { await fetch(`/api/empleados/${id}`, { method: 'DELETE' }); cargarEmpleados(); } catch(e) {} } }
    async function cargarEmpleados() { try { const res = await fetch('/api/empleados/'); const emps = await res.json(); document.getElementById('lista-empleados').innerHTML = ''; window.empleadosGlobal = emps; emps.forEach(e => { document.getElementById('lista-empleados').innerHTML += `<tr><td style=\"font-weight:600; color:var(--text-muted);\">${e.documento}</td><td>${e.nombre}</td><td>${e.puesto||''}</td><td style=\"text-align:center;\"><button class=\"btn-outline\" style=\"padding:5px 10px; margin-right:5px; color:var(--primary); border-color:transparent;\" onclick=\"iniciarEdicionEmpleado(${e.id}, '${e.nombre}', '${e.documento}', '${e.puesto||''}')\"><i class=\"ph ph-pencil-simple\"></i></button><button class=\"btn-outline\" style=\"padding:5px 10px; color:var(--danger); border-color:transparent;\" onclick=\"eliminarEmpleadoLocal(${e.id})\"><i class=\"ph ph-trash\"></i></button></td></tr>`; }); } catch(e){} }

    // --- CAJA (FINANZAS MEJORADA) ---
    async function cargarCaja() { 
        try { 
            const res = await fetch('/api/caja/'); 
            if (!res.ok) { console.warn("Aún no hay movimientos de caja."); renderizarGraficoFinanzas(0,0); return; }
            
            const movs = await res.json(); 
            const tbody = document.getElementById('lista-caja');
            tbody.innerHTML = ''; 
            
            if (movs.length === 0) {
                tbody.innerHTML = '<tr><td colspan=\"4\" style=\"text-align:center; color:gray;\">Sin movimientos en Caja</td></tr>';
                renderizarGraficoFinanzas(0,0);
                return;
            }

            let ingTot = 0; let egrTot = 0;
            movs.slice().reverse().forEach(mov => { 
                const fechaLimpia = mov.fecha ? new Date(mov.fecha) : new Date();
                const f = fechaLimpia.toLocaleDateString('es-AR', { hour: '2-digit', minute:'2-digit' }); 
                const c = mov.tipo === 'INGRESO' ? 'color:var(--success);' : 'color:var(--danger);'; 
                // Etiqueta visual del metodo de pago
                const metodoBadge = mov.metodo_pago ? `<br><span style="font-size:0.75rem; background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px; color:gray;">${mov.metodo_pago}</span>` : '';
                
                tbody.innerHTML += `<tr><td style=\"color:var(--text-muted); font-size:0.85rem;\">${f}</td><td>${mov.motivo} ${metodoBadge}</td><td style=\"font-weight:700; ${c}\">${mov.tipo==='INGRESO'?'+':'-'}$${mov.monto.toLocaleString('es-AR')}</td><td style=\"text-align:center;\"><button class=\"btn-outline\" style=\"padding:5px; color:var(--danger); border:none;\" onclick=\"eliminarMovimientoCaja(${mov.id})\"><i class=\"ph ph-trash\"></i></button></td></tr>`; 
                if(mov.tipo === 'INGRESO') ingTot += mov.monto; else egrTot += mov.monto;
            }); 
            renderizarGraficoFinanzas(ingTot, egrTot);
        } catch(e){ console.error("Error al cargar caja", e); renderizarGraficoFinanzas(0,0); } 
    }
    
    // ARREGLO DEL FORMULARIO DE CAJA (Con bloqueo de doble clic)
    const formCaja = document.getElementById('formCaja');
    if (formCaja) {
        // Clonamos y reemplazamos el formulario para matar cualquier evento duplicado viejo
        const nuevoFormCaja = formCaja.cloneNode(true);
        formCaja.parentNode.replaceChild(nuevoFormCaja, formCaja);

        nuevoFormCaja.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            const btnSubmit = e.submitter;
            btnSubmit.disabled = true; // Bloquea el botón
            btnSubmit.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';

            try {
                const radioSeleccionado = document.querySelector('input[name="caja_tipo"]:checked');
                const tipoSeleccionado = radioSeleccionado ? radioSeleccionado.value : 'INGRESO'; 
                
                const res = await fetch('/api/caja/', { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({ 
                        tipo: tipoSeleccionado, 
                        metodo_pago: document.getElementById('caja_metodo').value, 
                        monto: parseFloat(document.getElementById('caja_monto').value), 
                        motivo: document.getElementById('caja_motivo').value 
                    }) 
                }); 
                if (!res.ok) throw new Error(await res.text());
                nuevoFormCaja.reset(); 
                document.getElementById('caja_motivo').placeholder = 'Ej: Cobro servicio...'; 
                mostrarNotificacion("✅ Movimiento registrado en Caja.", "exito");
                cargarCaja(); 
            } catch(e) { 
                mostrarNotificacion("Error al registrar movimiento", "error"); 
            } finally {
                btnSubmit.disabled = false; // Desbloquea el botón
                btnSubmit.innerHTML = '💾 Guardar en Caja';
            }
        });
    }
    async function eliminarMovimientoCaja(id) { if(confirm("¿Seguro que desea borrar este movimiento de caja?")) { try { await fetch(`/api/caja/${id}`, { method: 'DELETE' }); cargarCaja(); } catch(e) {} } }
    
    // --- ASISTENCIA (QR MÓVIL Y REPORTE) ---
    function abrirModalQREmpleado() { document.getElementById('modal-qr-empleado').style.display = 'flex'; document.getElementById('qr_input_simulado').focus(); }
    async function procesarFichadaMovil() { 
        const dni = document.getElementById('fichada_movil_dni').value; 
        if (!dni) return; 
        try { 
            const res = await fetch('/api/asistencia/fichar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ documento: dni }) }); 
            const data = await res.json(); 
            if (res.ok) { 
                mostrarNotificacion(data.mensaje, "exito"); 
                document.getElementById('fichada_movil_dni').value = ''; 
                
                try {
                    const resEmp = await fetch('/api/empleados/');
                    const empleados = await resEmp.json();
                    // Búsqueda flexible por DNI
                    const mecanico = empleados.find(e => e.documento == dni); 
                    
                    if (mecanico) {
                        const resTar = await fetch('/api/tareas/');
                        const tareas = await resTar.json();
                        // Filtramos las tareas pendientes de este mecánico específico
                        const misTareas = tareas.filter(t => t.empleado_id == mecanico.id && t.estado !== 'Terminada');
                        
                        const panel = document.getElementById('fichada_panel_tareas');
                        const lista = document.getElementById('fichada_lista_tareas');
                        lista.innerHTML = '';
                        
                        if (misTareas.length > 0) {
                            misTareas.forEach(t => {
                                const vehiculoStr = t.vehiculo || 'Vehículo en Taller';
                                const boxStr = t.box || 'General';
                                
                                lista.innerHTML += `
                                <div style="background:#f4f4f5; padding:12px; border-radius:8px; display: flex; flex-direction: column; gap: 5px;">
                                    <span style="font-size: 0.8rem; color: gray;"><strong>${vehiculoStr}</strong> | Box: ${boxStr}</span>
                                    <strong style="color: var(--dark); font-size: 1.1rem;">${t.descripcion}</strong>
                                    <span style="font-size: 0.85rem; color: var(--warning); font-weight: bold;"><i class="ph ph-clock"></i> ${t.estado}</span>
                                </div>`;
                            });
                            panel.style.display = 'block';
                        } else {
                            panel.style.display = 'none';
                            mostrarNotificacion("Fichaje exitoso. No tenés tareas pendientes.", "info");
                        }
                    }
                } catch(err) { console.warn("No se pudieron cargar las tareas del mecánico."); }

            } else { 
                mostrarNotificacion("Error: " + data.detail, "error"); 
            } 
        } catch(e) { 
            mostrarNotificacion("Error de conexión.", "error"); 
        } 
    }
    // EL RELOJ RECALIBRADO PARA ARGENTINA
    async function cargarPresentesDashboard() { 
        try { 
            const res = await fetch('/api/asistencia/presentes'); 
            const presentes = await res.json(); 
            const listaDash = document.getElementById('lista-presentes-dash'); 
            listaDash.innerHTML = ''; 
            if (presentes.length === 0) { 
                listaDash.innerHTML = '<li style=\"text-align:center; color:var(--text-muted); padding: 15px;\">Nadie en turno activo.</li>'; 
            } else { 
                presentes.forEach(p => { 
                    // Forzamos la zona horaria de Argentina
                    const h = new Date(p.hora_entrada).toLocaleTimeString('es-AR', { hour: '2-digit', minute:'2-digit', timeZone: 'America/Argentina/Cordoba' }); 
                    listaDash.innerHTML += `<li style=\"display:flex; justify-content:space-between; padding: 12px 0; border-bottom: 1px solid var(--border-color); align-items:center;\"><span><i class=\"ph ph-user-circle\" style=\"color:var(--success); font-size:1.2rem; vertical-align:middle; margin-right:5px;\"></i> <strong>${p.nombre}</strong></span><span style=\"color:var(--text-muted); font-size:0.85rem;\"><i class=\"ph ph-clock\"></i> Ingreso: ${h}</span></li>`; 
                }); 
            } 
        } catch(e){} 
    }

    // --- PRESUPUESTOS (EDICIÓN Y BORRADO DE ITEMS) ---
    let itemsRapidos = [];
    function seleccionarServicioRapido() { const val = document.getElementById('select_catalogo_rapido').value; if(!val){document.getElementById('rapido_desc').value=""; document.getElementById('rapido_precio').value="";} else { const serv = JSON.parse(val); document.getElementById('rapido_desc').value = serv.nombre; document.getElementById('rapido_precio').value = serv.precio; } }
    function agregarItemRapido() { const desc = document.getElementById('rapido_desc').value; const cant = parseInt(document.getElementById('rapido_cant').value) || 1; const precio = parseFloat(document.getElementById('rapido_precio').value) || 0; if (!desc || precio <= 0) return; itemsRapidos.push({ descripcion: desc, cantidad: cant, precio_unitario: precio }); document.getElementById('rapido_desc').value = ''; document.getElementById('rapido_precio').value = ''; document.getElementById('select_catalogo_rapido').value = ''; renderizarItemsRapidos(); }
    function renderizarItemsRapidos() { const lista = document.getElementById('lista_items_rapidos'); lista.innerHTML = ''; let total = 0; itemsRapidos.forEach((item, index) => { const sub = item.cantidad * item.precio_unitario; total += sub; lista.innerHTML += `<tr><td>${item.descripcion}</td><td style=\"text-align:center;\">${item.cantidad}</td><td style=\"text-align:right; font-weight:bold; color:var(--dark);\">$${sub.toLocaleString('es-AR')}</td><td style=\"text-align:center;\"><button onclick=\"eliminarItemRapido(${index})\" style=\"background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.2rem;\"><i class=\"ph ph-trash\"></i></button></td></tr>`; }); document.getElementById('rapido_total').innerText = total.toLocaleString('es-AR'); }
    function eliminarItemRapido(index) { itemsRapidos.splice(index, 1); renderizarItemsRapidos(); }
    function seleccionarServicioPreCargado() { const val = document.getElementById('select_catalogo').value; if(!val){document.getElementById('item_desc').value=""; document.getElementById('item_precio').value="";} else { const serv = JSON.parse(val); document.getElementById('item_desc').value = serv.nombre; document.getElementById('item_precio').value = serv.precio; } }
    
    async function abrirModalPresupuesto(orden) { ordenActualParaPDF = orden; document.getElementById('modal_orden_id').value = orden.id; document.getElementById('modal-presupuesto').style.display = 'flex'; cargarItemsPresupuesto(orden.id); }
    
    async function cargarItemsPresupuesto(id_orden) { 
        try { 
            const res = await fetch(`/api/ordenes/${id_orden}/detalles`); 
            const det = await res.json(); 
            document.getElementById('lista_items_orden').innerHTML = ''; 
            let t = 0; 
            det.forEach(i => { 
                const s = i.cantidad * i.precio_unitario; 
                t += s; 
                
                document.getElementById('lista_items_orden').innerHTML += `
                    <li style=\"display:flex; justify-content:space-between; align-items:center;\">
                        <span style=\"flex:2;\"><strong>${i.cantidad}x</strong> ${i.descripcion}</span>
                        <div style=\"flex:1; display:flex; gap:10px; align-items:center; justify-content:flex-end;\">
                            <strong style=\"color:var(--text-muted); font-size:0.9rem;\">Precio Unit. $</strong> 
                            <input type=\"number\" value=\"${i.precio_unitario}\" style=\"width:100px; margin:0; padding:8px; text-align:right; border-color:var(--primary); font-weight:bold; color:var(--dark);\" onchange=\"actualizarPrecioDetalle(${id_orden}, ${i.id}, this.value)\">
                            <button onclick=\"eliminarDetalleOrden(${id_orden}, ${i.id})\" style=\"background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.2rem; margin-left:10px;\"><i class=\"ph ph-trash\"></i></button>
                        </div>
                    </li>`; 
            }); 
            document.getElementById('modal_total').innerText = t.toLocaleString('es-AR'); 
        } catch(e){} 
    }

    async function actualizarPrecioDetalle(id_orden, id_detalle, nuevo_precio) {
        try {
            const res = await fetch(`/api/ordenes/detalles/${id_detalle}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ precio_unitario: parseFloat(nuevo_precio) })
            });
            if(!res.ok) throw new Error("Falta configurar la ruta PUT en el backend.");
            cargarItemsPresupuesto(id_orden);
        } catch(e) { mostrarNotificacion("Error al actualizar precio: " + e.message, "error"); }
    }

    async function eliminarDetalleOrden(id_orden, id_detalle) {
        if(!confirm("¿Seguro que querés quitar este ítem de la orden?")) return;
        try {
            const res = await fetch(`/api/ordenes/detalles/${id_detalle}`, { method: 'DELETE' });
            cargarItemsPresupuesto(id_orden);
        } catch(e) { mostrarNotificacion("Error al eliminar: " + e.message, "error"); }
    }
    
    async function agregarItemPresupuesto() { const id = document.getElementById('modal_orden_id').value; const desc = document.getElementById('item_desc').value; const cant = document.getElementById('item_cant').value; const pre = document.getElementById('item_precio').value; if(!desc)return; await fetch(`/api/ordenes/${id}/detalles`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ descripcion: desc, cantidad: parseInt(cant), precio_unitario: parseFloat(pre||0) }) }); document.getElementById('item_desc').value=''; document.getElementById('item_precio').value=''; document.getElementById('select_catalogo').value=''; cargarItemsPresupuesto(id); }
    
    function crearMagiaPDF(listaItems, origen) {
        if(listaItems.length === 0) { mostrarNotificacion("Debe agregar al menos 1 servicio al presupuesto.", "error"); return; }
        
        const tallerNombre = window.tallerConfigGlobal?.nombre || "Taller Automotriz"; 
        const tallerDir = window.tallerConfigGlobal?.direccion || ""; 
        const tallerTel = window.tallerConfigGlobal?.telefono || ""; 
        const fecha = new Date().toLocaleDateString('es-AR');
        
        const esCotizacion = (origen === "Cotizacion"); 
        let cliente = ""; let vehiculo = ""; let patente = ""; let ordenNro = "";
        
        if (esCotizacion) { 
            cliente = document.getElementById('rapido_cliente')?.value || "Consumidor Final"; 
            const marca = document.getElementById('rapido_marca')?.value || ""; 
            const modelo = document.getElementById('rapido_modelo')?.value || ""; 
            vehiculo = (marca || modelo) ? `${marca} ${modelo}`.trim() : "A Confirmar"; 
        } else { 
            cliente = ordenActualParaPDF?.dueño || "Consumidor Final"; 
            vehiculo = ordenActualParaPDF?.vehiculo_desc || ""; 
            patente = "Patente: " + (ordenActualParaPDF?.patente || ""); 
            ordenNro = "00" + document.getElementById('modal_orden_id').value; 
        }
        
        let filasTabla = ""; let total = 0;
        listaItems.forEach(item => { 
            const subtotal = item.cantidad * item.precio_unitario; 
            total += subtotal; 
            filasTabla += `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding:12px; color:#18181b;">${item.descripcion}</td><td style="padding:12px; text-align:center; color:#18181b;">${item.cantidad}</td><td style="padding:12px; text-align:right; color:#18181b;">$${item.precio_unitario.toLocaleString('es-AR')}</td><td style="padding:12px; text-align:right; font-weight:900; color:#000000;">$${subtotal.toLocaleString('es-AR')}</td></tr>`; 
        });
        
        const logoHtml = logoBase64Actual ? `<img src="${logoBase64Actual}" style="max-height: 80px; margin-bottom: 10px;">` : ``;

        const htmlImpresion = `<!DOCTYPE html><html><head><title>${esCotizacion ? 'Cotización' : 'Presupuesto'}</title><style>body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #18181b; margin: 0; padding: 40px; } .header { display: flex; justify-content: space-between; border-bottom: 4px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; } .header h2 { margin: 0; color: #000000; font-size: 26px; text-transform: uppercase; font-weight: 900;} .header p { margin: 5px 0 0 0; color: #52525b; font-size: 14px; font-weight: bold;} .title-box { text-align: right; } .title-box h1 { margin: 0; color: #dc2626; text-transform: uppercase; letter-spacing: 1px; font-size: 28px; font-weight: 900;} .info-box { background: #f4f4f5; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e4e4e7; display: flex; gap: 20px; } .info-box div { flex: 1; font-size: 14px; } table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; } th { background-color: #000000; color: white; padding: 12px; text-align: left; text-transform: uppercase; letter-spacing: 1px; font-size: 12px;} .total-box { display: flex; justify-content: flex-end; } .total-box div { width: 250px; padding: 20px; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; text-align: right; } .total-box strong { font-size: 1.5rem; color: #000000; } .total-box span { color: #dc2626; font-weight: 900;} @page { size: A4; margin: 10mm; }</style></head><body> <div class="header"><div> ${logoHtml} <h2>${tallerNombre}</h2><p>${tallerDir}</p><p>Tel: ${tallerTel}</p></div><div class="title-box"><h1>${esCotizacion ? 'COTIZACIÓN' : 'PRESUPUESTO OFICIAL'}</h1><p style="font-weight:bold;">Fecha: ${fecha}</p>${!esCotizacion ? `<p style="color:gray;">Orden N°: ${ordenNro}</p>` : ''}</div></div><div class="info-box"><div><strong>Cliente:</strong> ${cliente}</div><div><strong>Vehículo:</strong> ${vehiculo} <span style="color:gray; font-style:italic;">${patente}</span></div></div><table><thead><tr><th>Descripción del Servicio / Repuesto</th><th style="text-align: center;">Cant.</th><th style="text-align: right;">Precio Unit.</th><th style="text-align: right;">Subtotal</th></tr></thead><tbody> ${filasTabla} </tbody></table><div class="total-box"><div><strong>TOTAL: <br><span>$${total.toLocaleString('es-AR')}</span></strong></div></div><script>window.onload=function(){window.print();};window.onafterprint=function(){window.close();};</script></body></html>`;
        
        const ventanaImpresion = window.open('', '_blank'); 
        ventanaImpresion.document.write(htmlImpresion); 
        ventanaImpresion.document.close(); 
        
        const modalPresupuesto = document.getElementById('modal-presupuesto');
        if (modalPresupuesto) modalPresupuesto.style.display='none';
        
        // Al terminar, limpiamos todo (Tanto presupuesto oficial como el rápido)
        limpiarPantallaPresupuesto();
        if (esCotizacion) {
            itemsRapidos = [];
            renderizarItemsRapidos();
            document.getElementById('rapido_cliente').value = '';
            document.getElementById('rapido_marca').value = '';
            document.getElementById('rapido_modelo').value = '';
        }
    }
    async function generarPDFOficial() { const id_orden = document.getElementById('modal_orden_id').value; const resItems = await fetch(`/api/ordenes/${id_orden}/detalles`); const itemsReales = await resItems.json(); crearMagiaPDF(itemsReales, "Orden Oficial");limpiarPantallaPresupuesto();}

    // ====================================================
    // LÓGICA DE PAGOS MIXTOS Y FINANZAS
    // ====================================================
    let pagosActuales = [];
    let montoTotalCobro = 0;

    async function abrirModalCobrar(idOrden, patente) {
        try {
            const res = await fetch(`/api/ordenes/${idOrden}/detalles`); 
            const detalles = await res.json(); 
            let total = 0; 
            detalles.forEach(d => total += (d.cantidad * d.precio_unitario));
            if (total === 0) mostrarNotificacion("Aviso: El presupuesto está en $0. Asegúrate de ponerle precio a los ítems.", "error");
            
            montoTotalCobro = total;
            pagosActuales = []; // Reiniciamos pagos
            
            document.getElementById('cobro_patente').innerText = patente; 
            document.getElementById('cobro_total').innerText = total.toLocaleString('es-AR'); 
            document.getElementById('cobro_monto_raw').value = total; 
            document.getElementById('cobro_orden_id').value = idOrden; 
            
            actualizarRestanteCobro();
            document.getElementById('modal-cobrar').style.display = 'flex';
        } catch (e) {}
    }

    function cerrarModalCobro() { document.getElementById('modal-cobrar').style.display = 'none'; pagosActuales = []; }

    function agregarPagoMixto() {
        const metodo = document.getElementById('pago_mixto_metodo').value;
        const monto = parseFloat(document.getElementById('pago_mixto_monto').value);
        if(!monto || monto <= 0) return;
        
        pagosActuales.push({ metodo_pago: metodo, monto: monto });
        document.getElementById('pago_mixto_monto').value = '';
        actualizarRestanteCobro();
    }

    function eliminarPagoMixto(index) {
        pagosActuales.splice(index, 1);
        actualizarRestanteCobro();
    }

    function actualizarRestanteCobro() {
        let totalPagado = 0;
        const ul = document.getElementById('lista_pagos_mixtos');
        ul.innerHTML = '';
        
        pagosActuales.forEach((p, index) => {
            totalPagado += p.monto;
            ul.innerHTML += `<li style="padding: 10px;">
                <span><i class="ph ph-money"></i> ${p.metodo_pago}</span>
                <div>
                    <strong style="color:var(--text-main);">$${p.monto.toLocaleString('es-AR')}</strong>
                    <button onclick="eliminarPagoMixto(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="ph ph-x"></i></button>
                </div>
            </li>`;
        });

        let restante = montoTotalCobro - totalPagado;
        if(restante < 0) restante = 0;
        
        document.getElementById('cobro_restante').innerText = restante.toLocaleString('es-AR');
        
        // Auto-sugiere lo que falta pagar en el input
        if (restante > 0) document.getElementById('pago_mixto_monto').value = restante;

        // Desbloquea el botón de Confirmar solo si se cubrió el total o si se anotó como "Fiado"
        const btnConfirmar = document.getElementById('btn_confirmar_cobro');
        if (totalPagado >= montoTotalCobro || pagosActuales.some(p => p.metodo_pago === 'Fiado')) {
            btnConfirmar.style.opacity = '1';
            btnConfirmar.style.pointerEvents = 'auto';
        } else {
            btnConfirmar.style.opacity = '0.5';
            btnConfirmar.style.pointerEvents = 'none';
        }
    }

    // Esta función inyecta cada pago directamente en la caja (Sin alterar tu Python backend)
    async function procesarCobroOrden() {
        const idOrden = document.getElementById('cobro_orden_id').value; 
        const patente = document.getElementById('cobro_patente').innerText;
        document.getElementById('modal-cobrar').style.display = 'none'; 
        
        try {
            // 1. Guardamos cada método de pago individualmente en la caja
            for (const pago of pagosActuales) {
                if (pago.metodo_pago !== 'Fiado') {
                    await fetch('/api/caja/', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            tipo: 'INGRESO',
                            metodo_pago: pago.metodo_pago,
                            monto: pago.monto,
                            motivo: `Cobro Orden - Patente: ${patente}`
                        })
                    });
                }
            }

            // 2. Liberamos el vehículo marcándolo como Entregado
            await fetch(`/api/ordenes/${idOrden}`, { 
                method: 'PUT', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ estado: 'Entregado', ubicacion: 'Entregado' }) 
            });
            
            mostrarNotificacion("✅ Pagos registrados con éxito. El vehículo fue entregado.", "exito"); 
            cargarTablero(); 
            cargarCaja();
        } catch(e) { mostrarNotificacion("Error al procesar el cobro: " + e.message, "error"); }
    }


    async function calcularMetricasAvanzadas() {
        try {
            // 1. CÁLCULO DE TIEMPO PROMEDIO (Ahora lee correctamente la hora local)
            const resO = await fetch('/api/ordenes/'); 
            if(!resO.ok) return;
            const ordenes = await resO.json();
            
            let totalHoras = 0;
            let autosTerminados = 0;
            let autosDelMes = 0;
            const mesActual = new Date().getMonth();

            ordenes.forEach(o => {
                const fechaIngreso = new Date(o.fecha_ingreso || Date.now());
                if (fechaIngreso.getMonth() === mesActual) autosDelMes++;

                if (o.estado === 'Terminado' || o.estado === 'Entregado') {
                    autosTerminados++;
                    const fechaFin = o.fecha_terminado ? new Date(o.fecha_terminado) : new Date();
                    const horasTardadas = Math.abs(fechaFin - fechaIngreso) / 36e5; 
                    totalHoras += horasTardadas;
                }
            });

            const elAutosMes = document.getElementById('dash-autos-mes');
            if(elAutosMes) elAutosMes.innerText = autosDelMes;
            
            const elPromedio = document.getElementById('dash-tiempo-promedio');
            if (autosTerminados > 0 && elPromedio) {
                let promedio = (totalHoras / autosTerminados).toFixed(1);
                if (promedio > 24) { elPromedio.innerText = (promedio / 24).toFixed(1) + " Días"; } 
                else { elPromedio.innerText = promedio + " Horas"; }
            } else if(elPromedio) {
                elPromedio.innerText = "0 Horas";
            }

            // 2. CÁLCULO DE HORAS TRABAJADAS (REPORTE MENSUAL)
            try {
                const resA = await fetch('/api/asistencia/'); 
                if (resA.ok) {
                    const asistencias = await resA.json();
                    const reporte = {}; 
                    const mesActual = new Date().getMonth();

                    asistencias.forEach(a => {
                        if (!a.hora_entrada) return; 
                        
                        const fechaE = new Date(a.hora_entrada);
                        if (fechaE.getMonth() !== mesActual) return; 

                        // Python ahora nos manda el nombre exacto, no hay que adivinarlo
                        const nombreFinal = a.nombre;

                        if (!reporte[nombreFinal]) reporte[nombreFinal] = { horas: 0, estado: 'Inactivo' };

                        if (a.hora_salida) {
                            const horas = Math.abs(new Date(a.hora_salida) - fechaE) / 36e5;
                            reporte[nombreFinal].horas += horas;
                        } else {
                            reporte[nombreFinal].estado = 'Trabajando';
                        }
                    });

                    const tbodyRRHH = document.getElementById('lista-reporte-mensual');
                    if(tbodyRRHH) {
                        tbodyRRHH.innerHTML = '';
                        if(Object.keys(reporte).length === 0) {
                            tbodyRRHH.innerHTML = '<tr><td colspan="3" style="text-align:center; color:gray;">Sin datos finalizados en este mes</td></tr>';
                        } else {
                            for (const [nombreEmp, data] of Object.entries(reporte)) {
                                const colorEstado = data.estado === 'Trabajando' ? 'color:var(--success); font-weight:bold;' : 'color:gray;';
                                tbodyRRHH.innerHTML += `<tr><td style="font-weight:600; text-transform:capitalize;">${nombreEmp}</td><td style="font-weight:900; font-size:1.1rem;">${data.horas.toFixed(1)} hs</td><td style="${colorEstado}">${data.estado}</td></tr>`;
                            }
                        }
                    }
                }
            } catch(e) { console.log("Aviso: Falta conectar ruta de asistencia", e); }

        } catch(e) { console.log("Aviso en métricas globales:", e); }
    }
// 3. LIMPIEZA DEL PRESUPUESTO ARREGLADA
    function limpiarPantallaPresupuesto() {
        document.getElementById("item_desc").value = "";
        document.getElementById("item_cant").value = "1";
        document.getElementById("item_precio").value = "";
        document.getElementById("select_catalogo").selectedIndex = 0;
        document.getElementById("lista_items_orden").innerHTML = "";
        document.getElementById("modal_total").innerText = "0.00";
    }
// --- LÓGICA DEL TURNERO MENSUAL ---
    // --- LÓGICA DEL TURNERO Y SINCRONIZACIÓN ---
    async function cargarTurnos() {
        try {
            const res = await fetch('/api/turnos/');
            const turnos = await res.json();
            const tbody = document.getElementById('lista_turnos_agenda');
            tbody.innerHTML = '';
            if(turnos.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:gray;">No hay turnos agendados.</td></tr>'; return; }
            
            turnos.forEach(t => {
                const fechaFormat = new Date(t.fecha_hora).toLocaleString('es-AR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                let colorEst = t.estado === 'Pendiente' ? 'color:var(--warning);' : (t.estado === 'Confirmado' ? 'color:var(--success);' : 'color:var(--danger);');
                
                // Creamos el botón mágico si el turno está pendiente
                let btnAccion = '';
                if(t.estado === 'Pendiente') {
                    btnAccion = `<button class="btn-success" style="padding: 8px 12px; font-size: 0.85rem;" onclick="enviarTurnoARecepcion('${t.cliente_nombre}', '${t.vehiculo}', '${t.motivo}', ${t.id})"><i class="ph ph-car-profile"></i> Ingresar</button>`;
                } else {
                    btnAccion = `<span style="color: gray; font-size: 0.85rem;"><i class="ph ph-check"></i> En Taller</span>`;
                }

                tbody.innerHTML += `<tr>
                    <td><strong>${fechaFormat}</strong></td>
                    <td>${t.cliente_nombre}</td>
                    <td>${t.vehiculo}</td>
                    <td>${t.motivo}</td>
                    <td style="font-weight:bold; ${colorEst}">${t.estado}</td>
                    <td style="text-align:center;">${btnAccion}</td>
                </tr>`;
            });
        } catch(e) { console.log("Turnero offline"); }
    }

    // Función que captura los datos del turno y los inyecta en Recepción
    async function enviarTurnoARecepcion(clienteNombre, vehiculoStr, motivo, idTurno) {
        // 1. Buscamos el botón del menú de Recepción y lo simulamos (para cambiar de pantalla)
        const botonMenuRecepcion = document.querySelector('[onclick*="recepcion"]');
        if (botonMenuRecepcion) cambiarSeccion('recepcion', botonMenuRecepcion);

        // 2. Inyectamos el nombre del cliente
        document.getElementById('nuevo_nombre').value = clienteNombre;
        
        // 3. Separamos el texto del vehículo (Ej: "VW Amarok" -> Marca: VW, Modelo: Amarok)
        let partesVehiculo = vehiculoStr.split(' ');
        if (partesVehiculo.length > 1) {
            document.getElementById('recepcion_marca').value = partesVehiculo[0];
            document.getElementById('recepcion_modelo').value = partesVehiculo.slice(1).join(' ');
        } else {
            document.getElementById('recepcion_modelo').value = vehiculoStr;
        }

        // 4. Inyectamos el motivo en el Checklist para que el recepcionista no lo olvide
        document.getElementById('rec_detalles').value = "MOTIVO DEL TURNO: " + motivo + "\n\n(Observaciones del vehículo al ingresar...)";
        
        // 5. Actualizamos el estado del turno en la base de datos a "Confirmado"
        try {
            await fetch(`/api/turnos/${idTurno}`, { 
                method: 'PUT', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ estado: 'Confirmado' }) 
            });
        } catch (e) { console.log("Aviso: No se pudo actualizar el estado del turno.", e); }
    }
    async function agendarNuevoTurno(e) {
        e.preventDefault();
        const datos = { 
            fecha_hora: document.getElementById('turno_fecha').value, 
            cliente_nombre: document.getElementById('turno_cliente').value, 
            vehiculo: document.getElementById('turno_vehiculo').value, 
            motivo: document.getElementById('turno_motivo').value 
        };
        try {
            const res = await fetch('/api/turnos/', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(datos) });
            if(!res.ok) throw new Error("Error del servidor");
            document.getElementById('formTurno').reset();
            cargarTurnos();
            mostrarNotificacion("✅ Turno agendado correctamente en la nube.", "exito");
        } catch(error) { mostrarNotificacion("Error al agendar el turno.", "error"); }
    }
    window.onload = detectarVistasMoviles;

    // ====================================================
// TABLERO DE TAREAS Y MODO TV (ALTO RENDIMIENTO)
// ====================================================

// 1. CARGA DEL KANBAN ADMINISTRADOR
async function cargarTableroAdmin() {
    try {
        const [resTareas, resOrdenes, resEmpleados] = await Promise.all([
            fetch('/api/tareas/'), fetch('/api/ordenes/'), fetch('/api/empleados/')
        ]);
        
        const tareas = await resTareas.json();
        const ordenes = await resOrdenes.json();
        const empleados = await resEmpleados.json();

        // Llenar Selects rápidos (Usamos DocumentFragment para máxima velocidad)
        const fragOrd = document.createDocumentFragment();
        ordenes.filter(o => o.estado !== 'Entregado').forEach(o => {
            const opt = document.createElement('option'); opt.value = o.id; opt.textContent = `${o.patente} - ${o.vehiculo_desc}`; fragOrd.appendChild(opt);
        });
        document.getElementById('tarea_orden').innerHTML = '<option value="">Seleccione Auto...</option>';
        document.getElementById('tarea_orden').appendChild(fragOrd);

        const fragEmp = document.createDocumentFragment();
        empleados.forEach(e => {
            const opt = document.createElement('option'); opt.value = e.id; opt.textContent = e.nombre; fragEmp.appendChild(opt);
        });
        document.getElementById('tarea_empleado').innerHTML = '<option value="">Seleccione Mecánico...</option>';
        document.getElementById('tarea_empleado').appendChild(fragEmp);

        // Llenar Columnas Kanban
        document.getElementById('kb_pendientes').innerHTML = '';
        document.getElementById('kb_proceso').innerHTML = '';
        document.getElementById('kb_terminadas').innerHTML = '';

        tareas.forEach(t => {
            let colorClase = t.estado === 'Terminada' ? 'terminada' : (t.estado === 'En Proceso' ? 'en-proceso' : '');
            let icono = t.estado === 'Terminada' ? 'check-circle' : 'wrench';
            
            let card = `<div class="tarea-card ${colorClase}">
                <div style="font-size:0.8rem; color:gray; margin-bottom:5px;"><strong>${t.vehiculo}</strong> | Box: ${t.box}</div>
                <div style="font-weight:bold; margin-bottom:10px;">${t.descripcion}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.85rem; background:rgba(0,0,0,0.05); padding:3px 8px; border-radius:4px;"><i class="ph ph-user"></i> ${t.mecanico}</span>
                    <button class="btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="cambiarEstadoTareaAdmin(${t.id}, '${t.estado}')"><i class="ph ph-${icono}"></i> Mover</button>
                </div>
            </div>`;

            if(t.estado === 'Pendiente') document.getElementById('kb_pendientes').innerHTML += card;
            else if(t.estado === 'En Proceso') document.getElementById('kb_proceso').innerHTML += card;
            else document.getElementById('kb_terminadas').innerHTML += card;
        });

    } catch (e) { console.error("Error cargando tablero"); }
}

async function crearTareaAdmin() {
    const datos = {
        orden_id: document.getElementById('tarea_orden').value,
        empleado_id: document.getElementById('tarea_empleado').value,
        descripcion: document.getElementById('tarea_desc').value
    };
    if(!datos.orden_id || !datos.descripcion) return;
    await fetch('/api/tareas/', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
    document.getElementById('tarea_desc').value = '';
    cargarTableroAdmin();
}

async function cambiarEstadoTareaAdmin(id, estadoActual) {
    let nuevoEstado = estadoActual === 'Pendiente' ? 'En Proceso' : (estadoActual === 'En Proceso' ? 'Terminada' : 'Pendiente');
    await fetch(`/api/tareas/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({estado: nuevoEstado}) });
    cargarTableroAdmin();
}

// 2. TAREAS DEL MECÁNICO (Celular)
// Llama a esta función dentro de `mecanicoIngresarVehiculo()` o cuando cargue el box
async function cargarTareasDeMecanicoEnCelular(ordenId) {
    const res = await fetch('/api/tareas/');
    const todas = await res.json();
    // Filtramos solo las de esta orden
    const misTareas = todas.filter(t => t.orden_id == ordenId);
    
    const div = document.getElementById('mecanico_lista_tareas');
    div.innerHTML = '';
    if(misTareas.length === 0) div.innerHTML = '<span style="color:gray;">No hay tareas específicas asignadas.</span>';

    misTareas.forEach(t => {
        let btnClase = t.estado === 'Pendiente' ? 'btn-outline' : (t.estado === 'En Proceso' ? 'btn-warning' : 'btn-success');
        let txtBtn = t.estado === 'Terminada' ? '<i class="ph ph-check"></i> Lista' : (t.estado === 'En Proceso' ? 'Terminar' : 'Iniciar');
        
        div.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f4f4f5; padding:12px; border-radius:8px;">
            <div style="${t.estado === 'Terminada' ? 'text-decoration:line-through; color:gray;' : 'font-weight:bold;'}">${t.descripcion}</div>
            <button class="${t.estado === 'Terminada' ? 'btn-success' : 'btn-primary'}" style="padding:8px 15px;" onclick="cambiarEstadoTareaAdmin(${t.id}, '${t.estado}').then(()=>cargarTareasDeMecanicoEnCelular(${ordenId}))">${txtBtn}</button>
        </div>`;
    });
}

// 3. EL MODO TV (Refresco automático sin recargar la página entera)
function iniciarModoTV() {
    // Reloj
    setInterval(() => {
        document.getElementById('tv_reloj').innerText = new Date().toLocaleTimeString('es-AR');
    }, 1000);

    // Cargar datos cada 15 segundos sin parpadear
    actualizarPantallaTV();
    setInterval(actualizarPantallaTV, 15000);
}

async function actualizarPantallaTV() {
    try {
        const [resTareas, resOrdenes] = await Promise.all([fetch('/api/tareas/'), fetch('/api/ordenes/')]);
        const tareas = await resTareas.json();
        const ordenes = await resOrdenes.json();

        const grid = document.getElementById('tv_contenedor_boxes');
        grid.innerHTML = '';

        // Solo mostramos las órdenes que están en un Box
        const ordenesEnBox = ordenes.filter(o => o.estado === 'En Box' && o.ubicacion);
        
        if(ordenesEnBox.length === 0) {
            grid.innerHTML = '<h2 style="text-align:center; color:gray; width:100%; margin-top:50px;">EL TALLER ESTÁ VACÍO</h2>';
            return;
        }

        ordenesEnBox.forEach(o => {
            let htmlBox = `<div class="tv-box">
                <div class="tv-box-title">${o.ubicacion} <span style="color:white; font-size:1.5rem; float:right;">${o.patente}</span></div>
                <div style="color:gray; margin-bottom:15px; font-size:1.2rem;">${o.vehiculo_desc}</div>`;
            
            // Buscar tareas de este auto
            let tareasAuto = tareas.filter(t => t.vehiculo.includes(o.patente) && t.estado !== 'Terminada');
            
            if(tareasAuto.length === 0) {
                htmlBox += `<div class="tv-task" style="color:gray; justify-content:center;">Sin tareas activas</div>`;
            } else {
                tareasAuto.forEach(t => {
                    let claseEst = t.estado === 'En Proceso' ? 'tv-task-proceso' : 'tv-task-pendiente';
                    htmlBox += `<div class="tv-task ${claseEst}">
                        <span>${t.descripcion}</span>
                        <span style="color:var(--primary); font-weight:bold;">${t.mecanico}</span>
                    </div>`;
                });
            }
            htmlBox += `</div>`;
            grid.innerHTML += htmlBox;
        });
    } catch(e) { console.warn("Error refrescando TV"); }
}

// --- CONTROL DEL MENÚ EN CELULARES ---
function abrirMenuMovil() {
    document.getElementById('sidebar').classList.add('abierto');
}

function cerrarMenuMovil() {
    document.getElementById('sidebar').classList.remove('abierto');
}

// --- CONTROL DEL MENÚ Y SINCRONIZACIÓN EN TIEMPO REAL ---
function cambiarSeccion(idSeccion, elementoMenu) {
    const secciones = document.querySelectorAll('.section');
    secciones.forEach(sec => sec.style.display = 'none');

    const seccionDestino = document.getElementById('sec-' + idSeccion);
    if (seccionDestino) seccionDestino.style.display = 'block';

    const botonesMenu = document.querySelectorAll('.menu-item');
    botonesMenu.forEach(btn => btn.classList.remove('active'));
    if (elementoMenu) elementoMenu.classList.add('active');

    // Cierra el menú en celulares
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('abierto');
    }

    // 🔥 SINCRONIZACIÓN FORZADA: Trae los datos frescos según la pantalla
    if (idSeccion === 'dashboard') { cargarTablero(); cargarPresentesDashboard(); }
    if (idSeccion === 'clientes') cargarClientesCRM();
    if (idSeccion === 'presupuestos' || idSeccion === 'gestion') cargarCatalogoYBoxes(); 
    if (idSeccion === 'recepcion' || idSeccion === 'taller') cargarTablero();
    if (idSeccion === 'turnos') cargarTurnos();
    if (idSeccion === 'empleados') cargarEmpleados();
    if (idSeccion === 'caja') cargarCaja();
    if (idSeccion === 'tareas') cargarTableroAdmin();
}

// ====================================================
// LÓGICA DE INVENTARIO Y STOCK AUTOMÁTICO
// ====================================================
let inventarioGlobal = [];

async function cargarInventario() {
    try {
        const res = await fetch('/api/inventario');
        if (!res.ok) return;
        inventarioGlobal = await res.json();
        
        const tbody = document.getElementById('lista_inventario');
        if (tbody) tbody.innerHTML = '';
        
        const datalistMec = document.getElementById('lista-repuestos-inventario');
        if (datalistMec) datalistMec.innerHTML = '';

        inventarioGlobal.forEach(item => {
            // Pintar tabla administrador
            if (tbody) {
                let badge = item.stock_actual <= 0 ? `<span class="badge-deuda">SIN STOCK</span>` : 
                           (item.stock_actual <= item.stock_minimo ? `<span style="color:var(--warning); font-weight:bold;">BAJO</span>` : `<span style="color:var(--success); font-weight:bold;">OK</span>`);
                
                tbody.innerHTML += `<tr>
                    <td style="color:gray;">${item.codigo || '-'}</td>
                    <td><strong>${item.nombre}</strong></td>
                    <td style="font-size:1.1rem; font-weight:bold; text-align:center;">${item.stock_actual}</td>
                    <td style="text-align:center;">${badge}</td>
                </tr>`;
            }
            // Llenar autocompletado del mecánico
            if (datalistMec && item.stock_actual > 0) {
                datalistMec.innerHTML += `<option value="${item.nombre}">Quedan: ${item.stock_actual}</option>`;
            }
        });
    } catch (e) { console.warn("Módulo de inventario apagado."); }
}

// Guardar nuevo repuesto
document.getElementById('formInventario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('/api/inventario', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                codigo: document.getElementById('inv_codigo').value,
                nombre: document.getElementById('inv_nombre').value,
                stock_actual: parseInt(document.getElementById('inv_stock').value),
                categoria: "Repuesto"
            })
        });
        if (!res.ok) throw new Error("Error al guardar inventario");
        document.getElementById('formInventario').reset();
        mostrarNotificacion("✅ Repuesto guardado en stock", "exito");
        cargarInventario();
    } catch(e) { mostrarNotificacion(e.message, "error"); }
});

// Modificación clave: Al cargar los datos globales al inicio, ahora también carga el inventario
const oldCargarDatosGlobales = cargarDatosGlobales;
cargarDatosGlobales = async function() {
    await oldCargarDatosGlobales();
    cargarInventario(); // <--- Llama al inventario también
}

// ====================================================
// LÓGICA DE FIADO (COBRO DE DEUDAS)
// ====================================================
function abrirModalPagoDeuda(id, nombre, deuda) {
    document.getElementById('deuda_cliente_id').value = id;
    document.getElementById('deuda_nombre_cliente').innerText = nombre;
    document.getElementById('deuda_monto_total').innerText = deuda.toLocaleString('es-AR');
    document.getElementById('deuda_monto_pagar').value = deuda; // Le sugiere pagar todo junto
    document.getElementById('modal-pago-deuda').style.display = 'flex';
}

async function procesarPagoDeuda() {
    const id = document.getElementById('deuda_cliente_id').value;
    const monto = parseFloat(document.getElementById('deuda_monto_pagar').value);
    const metodo = document.getElementById('deuda_metodo_pago').value;
    
    try {
        const res = await fetch(`/api/clientes/${id}/pagar_deuda`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ monto: monto, metodo_pago: metodo })
        });
        if (!res.ok) throw new Error(await res.text());
        
        mostrarNotificacion("✅ Pago de deuda registrado en Caja", "exito");
        document.getElementById('modal-pago-deuda').style.display = 'none';
        
        // Refrescamos todo para que los números den bien
        cargarCaja(); 
        cargarClientesCRM(); 
        document.getElementById('crm_historial_datos').innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 50px;">Seleccione un cliente del directorio para ver su actualización.</div>';
    } catch (e) { mostrarNotificacion("Error al procesar el pago", "error"); }
}