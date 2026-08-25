const LOCATIONS = [
  'Plaza San Francisco',
  'Terminal de buses La Paz',
  'Terminal Minasa',
  'terminal de buses El Alto',
  'Plaza del maestro',
  'Plaza San Pedro',
  'Plaza triangular',
  'Plaza Uyuni',
  'estadio Hernando Siles',
  'cotahuma',
  'Achumani',
  'Los Pinos',
  'Calacoto',
  'Mallasa',
  'Cementerio General',
  'Correos',
  'Obelisco',
  'San Miguel',
  'Obrajes',
  'Alto Obrajes',
  'Alto Seguencoma',
  'bajo Seguencoma',
  'Sopocachi',
  'Miraflores',
  'San Pedro',
  'villa Fátima',
  'monoblock',
  'plaza Isabel la católica',
  '6 de agosto',
  'Av arce',
  'Plaza Bolivia',
  'Plaza Camacho',
  'Multicine',
  'plaza Riosiño',
  'Achachicala',
  'Plan autopista',
  'Garita',
  'Tumusla',
  'Max Paredes',
  'plaza eguino',
  'mercado de las brujas',
  'Mercado Hinojosa',
  'Mercado Sopocachi',
  'Zona Gran poder',
  'Zona La Portada',
  'Ceibo',
  'infocal',
  'Pando',
  'Trinidad',
  'Santa Cruz',
  'Oruro',
  'Potosí',
  'Cochabamba',
  'Sucre',
  'Tarija',
  'Bermejo',
  'Uyuni',
  'Llallagua',
  'Tupiza',
  'Villazón',
  'Quillacollo',
  'Coroico',
  'Copacabana',
  'Tlf. Rojo Estación Central',
  'Tlf. Rojo Cementerio',
  'Tlf. Rojo 16 de Julio',
  'Tlf. Amarillo Mirador',
  'Tlf. Amarillo Buenos Aires',
  'Tlf. Amarillo Sopocachi',
  'Tlf. Amarillo Libertador',
  'Tlf. Verde Libertador',
  'Tlf. Verde Alto Obrajes',
  'Tlf. Verde Irpavi',
  'Tlf. Verde San Miguel',
  'Tlf. Azul Río Seco',
  'Tlf. Azul Plaza La Paz',
  'Tlf. Azul Plaza Libertad',
  'Tlf. Azul UPEA',
  'Tlf. Azul 16 de Julio',
  'Tlf. Naranja Estación Central',
  'Tlf. Naranja Armentia',
  'Tlf. Naranja Periférica',
  'Tlf. Naranja Plaza Villarroel',
  'Tlf. Blanca Plaza Villarroel',
  'Tlf. Blanca Busch',
  'Tlf. Blanca Triangular',
  'Tlf. Blanca Av. Poeta',
  'Tlf. Celeste Prado',
  'Tlf. Celeste San Jorge',
  'Tlf. Celeste Av. Poeta',
  'Tlf. Celeste Libertador',
  'Tlf. Morada 6 de Marzo',
  'Tlf. Morada Faro Murillo',
  'Tlf. Morada San José',
  'Tlf. Café Monumento Busch',
  'Tlf. Café De las Villas',
  'Tlf. Plateada 16 de Julio',
  'Tlf. Plateada Faro Murillo',
  'Tlf. Plateada Mirador',
];

const SELLERS = ['Rossell', 'Tawi', 'Papa', 'Paola', 'Otro'];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const state = {
  dashboard: { products: 0, clients: 0, sales: 0, purchases: 0, production: 0 },
  products: [],
  clients: [],
  activeSection: 'register',
  activeRegisterForm: 'product',
  activeConsultTab: 'sales',
  saleFilter: 'all',
  editing: null,
  consultRequestId: 0,
};

const els = {
  registerSection: document.querySelector('#register-section'),
  consultSection: document.querySelector('#consult-section'),
  exportSection: document.querySelector('#export-section'),
  formArea: document.querySelector('#form-area'),
  tableArea: document.querySelector('#table-area'),
  productsSidebar: document.querySelector('#products-sidebar'),
  clientsSidebar: document.querySelector('#clients-sidebar'),
  modal: document.querySelector('#modal'),
  modalContent: document.querySelector('#modal-content'),
  toast: document.querySelector('#toast'),
  exportForm: document.querySelector('#export-form'),
};

function api(path, options = {}) {
  return fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  }).then(async (response) => {
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(data?.error || 'Error de servidor');
    }
    return data;
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '';
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value.includes('T') ? value : `${value}T00:00:00`)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-BO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function money(value) {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 2600);
}

function openModal(content) {
  els.modalContent.innerHTML = content;
  els.modal.classList.remove('hidden');
  els.modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  els.modal.classList.add('hidden');
  els.modal.setAttribute('aria-hidden', 'true');
  els.modalContent.innerHTML = '';
}

function setSection(section) {
  state.activeSection = section;
  els.registerSection.classList.toggle('hidden', section !== 'register');
  els.consultSection.classList.toggle('hidden', section !== 'consult');
  els.exportSection.classList.toggle('hidden', section !== 'export');
}

function familyOptions(selectedId = '') {
  return ['<option value="">Selecciona un producto</option>']
    .concat(
      state.products.map((family) => {
        return `<option value="${family.id}" ${String(family.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(
          family.name
        )}</option>`;
      })
    )
    .join('');
}

function clientOptions(selectedId = '') {
  return ['<option value="">Sin cliente</option>']
    .concat(
      state.clients.map((client) => {
        return `<option value="${client.id}" ${String(client.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(
          client.name
        )}</option>`;
      })
    )
    .join('');
}

function variantsForFamily(familyId) {
  const family = state.products.find((item) => String(item.id) === String(familyId));
  return family ? family.variants || [] : [];
}

function basePage() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => setSection(btn.dataset.nav));
  });

  document.querySelectorAll('.tile, .mini-action').forEach((btn) => {
    btn.addEventListener('click', () => renderRegisterForm(btn.dataset.form));
  });

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeConsultTab = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el === btn));
      renderConsultView();
    });
  });

  document.querySelectorAll('[data-sale-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.saleFilter = btn.dataset.saleFilter;
      document.querySelectorAll('[data-sale-filter]').forEach((el) =>
        el.classList.toggle('active', el === btn)
      );
      renderConsultView();
    });
  });

  els.modal.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-modal]')) closeModal();
  });

  els.exportForm.addEventListener('submit', handleExport);
  document.body.addEventListener('click', handleBodyClick);
  document.body.addEventListener('input', handleBodyInput);
  document.body.addEventListener('change', handleBodyChange);
}

function renderDashboard() {
  document.querySelector('#metric-products').textContent = state.dashboard.products;
  document.querySelector('#metric-clients').textContent = state.dashboard.clients;
  document.querySelector('#metric-sales').textContent = state.dashboard.sales;
  document.querySelector('#metric-purchases').textContent = state.dashboard.purchases;
}

function renderSidebar() {
  els.productsSidebar.innerHTML = state.products.length
    ? state.products
        .map((family) => {
          const colors = family.variants.map((variant) => variant.color).join(', ');
          return `
            <div class="list-item">
              <strong>${escapeHtml(family.name)}</strong>
              <small>${escapeHtml(colors || 'Sin colores')}${family.variants[0] ? ` - Bs ${money(family.variants[0].price)}` : ''}</small>
            </div>
          `;
        })
        .join('')
    : '<div class="subtle">No hay productos registrados.</div>';

  els.clientsSidebar.innerHTML = state.clients.length
    ? state.clients
        .map(
          (client) => `
          <div class="list-item">
            <strong>${escapeHtml(client.name)}</strong>
            <small>${escapeHtml(client.phone || client.ci || 'Sin datos extra')}</small>
          </div>
        `
        )
        .join('')
    : '<div class="subtle">No hay clientes registrados.</div>';
}

function renderRegisterForm(type) {
  state.activeRegisterForm = type;
  state.editing = null;
  const date = todayISO();

  const templates = {
    product: `
      <div class="card">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Registrar</p>
            <h2>Producto</h2>
          </div>
        </div>
        <form class="form-grid" data-form-type="product">
          <label class="field full">
            <span>Nombre</span>
            <input name="familyName" placeholder="Bomber Entero" required />
          </label>
          <label class="field">
            <span>Color</span>
            <input name="color" placeholder="Negro" required />
          </label>
          <label class="field">
            <span>Precio</span>
            <input name="price" type="number" min="0" step="0.01" required />
          </label>
          <div class="form-actions full">
            <button class="primary" type="submit">Guardar producto</button>
          </div>
        </form>
      </div>
    `,
    client: `
      <div class="card">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Registrar</p>
            <h2>Cliente</h2>
          </div>
        </div>
        <form class="form-grid" data-form-type="client">
          <label class="field full">
            <span>Nombre</span>
            <input name="name" placeholder="Nombre del cliente" required />
          </label>
          <label class="field">
            <span>CI opcional</span>
            <input name="ci" placeholder="1234567" />
          </label>
          <label class="field">
            <span>Numero de telefono</span>
            <input name="phone" placeholder="70000000" />
          </label>
          <div class="form-actions full">
            <button class="primary" type="submit">Guardar cliente</button>
          </div>
        </form>
      </div>
    `,
    sale: movementFormTemplate({
      title: 'Venta',
      kind: 'sale',
      allowClient: false,
      allowPriceEdit: false,
      showSeller: true,
      showCommission: true,
      showLocation: true,
      requireSize: true,
      itemLabel: 'Item de venta',
    }),
    order: movementFormTemplate({
      title: 'Pedido',
      kind: 'order',
      allowClient: true,
      allowPriceEdit: true,
      showSeller: true,
      showCommission: true,
      showLocation: true,
      requireSize: true,
      itemLabel: 'Item de pedido',
    }),
    production: movementFormTemplate({
      title: 'Produccion',
      kind: 'production',
      allowClient: false,
      allowPriceEdit: false,
      showSeller: false,
      showCommission: false,
      showLocation: false,
      requireSize: true,
      itemLabel: 'Item de produccion',
    }),
    purchase: `
      <div class="card">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Registrar</p>
            <h2>Compra</h2>
          </div>
        </div>
        <form class="form-grid" data-form-type="purchase">
          <div class="field">
            <span>Fecha</span>
            <div class="date-wrap">
              <input name="movementDate" class="date-input" data-date value="${date}" readonly required />
            </div>
          </div>
          <label class="field">
            <span>Material</span>
            <input name="materialName" placeholder="Tafeta" required />
          </label>
          <label class="field">
            <span>Cantidad</span>
            <input name="quantity" type="number" min="1" step="1" required />
          </label>
          <label class="field">
            <span>Color opcional</span>
            <input name="color" placeholder="Negro" />
          </label>
          <label class="field">
            <span>Precio total</span>
            <input name="totalPrice" type="number" min="0" step="0.01" required />
          </label>
          <label class="field">
            <span>Lugar opcional</span>
            <input name="location" list="location-list" placeholder="Mercado, tienda o ciudad" />
          </label>
          <label class="field full">
            <span>Observaciones</span>
            <textarea name="observations" placeholder="Notas opcionales"></textarea>
          </label>
          <div class="form-actions full">
            <button class="primary" type="submit">Guardar compra</button>
          </div>
        </form>
      </div>
    `,
  };

  els.formArea.innerHTML = templates[type];
  initDatePickers(els.formArea);
  if (type === 'sale' || type === 'order' || type === 'production') {
    const form = els.formArea.querySelector('form');
    wireMovementForm(form, { kind: type, allowClient: type === 'order', allowPriceEdit: type === 'order' });
  }

  if (type === 'purchase') {
    const form = els.formArea.querySelector('form');
    form.addEventListener('submit', handlePurchaseSubmit);
  }

  if (type === 'product') {
    const form = els.formArea.querySelector('form');
    form.addEventListener('submit', handleProductSubmit);
  }

  if (type === 'client') {
    const form = els.formArea.querySelector('form');
    form.addEventListener('submit', handleClientSubmit);
  }
}

function movementFormTemplate({
  title,
  kind,
  allowClient,
  allowPriceEdit,
  showSeller,
  showCommission,
  showLocation,
  requireSize,
  itemLabel,
}) {
  const date = todayISO();
  const locationField = showLocation
    ? `
      <label class="field">
        <span>Lugar</span>
        <input name="location" list="location-list" placeholder="Escribe o elige un lugar" />
      </label>
    `
    : '';

  const sellerField = showSeller
    ? `
      <label class="field">
        <span>Ejecutante</span>
        <select name="executedBy" required>
          ${SELLERS.map((seller) => `<option value="${seller}">${seller}</option>`).join('')}
        </select>
      </label>
      <label class="field" data-seller-other style="display:none;">
        <span>Si es otro, escribe el nombre</span>
        <input name="executedByCustom" placeholder="Nombre" />
      </label>
    `
    : '';

  const commissionField = showCommission
    ? `
      <label class="field" data-commission-field style="display:none;">
        <span>Comision</span>
        <input name="commission" type="number" min="0" step="0.01" />
      </label>
    `
    : '';

  const clientField = allowClient
    ? `
      <label class="field full">
        <span>Cliente</span>
        <select name="clientId">
          ${clientOptions()}
        </select>
      </label>
    `
    : '';

  return `
    <div class="card">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Registrar</p>
          <h2>${title}</h2>
        </div>
        <div class="pill">Total automatico con validaciones</div>
      </div>
      <form class="form-grid" data-form-type="${kind}" data-allow-price-edit="${allowPriceEdit ? '1' : '0'}">
        <div class="field">
          <span>Fecha</span>
          <div class="date-wrap">
            <input name="movementDate" class="date-input" data-date value="${date}" readonly required />
          </div>
        </div>
        <label class="field">
          <span>Producto</span>
          <select name="productFamilyId" required>
            ${familyOptions()}
          </select>
        </label>
        ${clientField}
        ${sellerField}
        ${commissionField}
        ${locationField}
        <div class="field full">
          <span>${itemLabel}</span>
          <div class="split-rows" data-items></div>
          <div class="secondary-actions" style="margin-top:12px;">
            <button class="ghost" type="button" data-add-item>Agregar fila</button>
          </div>
          <div class="subtle" style="margin-top:8px;">
            La suma de cantidades de las filas debe coincidir con la cantidad total.
          </div>
        </div>
        <label class="field">
          <span>Cantidad total</span>
          <input name="quantityTotal" type="number" min="1" step="1" required />
        </label>
        <label class="field">
          <span>Precio total</span>
          <input name="totalPrice" type="number" min="0" step="0.01" readonly />
        </label>
        <label class="field full">
          <span>Observaciones</span>
          <textarea name="observations" placeholder="Notas opcionales"></textarea>
        </label>
        <div class="form-actions full">
          <div class="secondary-actions">
            <button class="ghost" type="button" data-fill-one>Una sola fila</button>
            <button class="ghost" type="button" data-reset-items>Limpiar filas</button>
          </div>
          <button class="primary" type="submit">Guardar ${title.toLowerCase()}</button>
        </div>
        <datalist id="location-list">
          ${LOCATIONS.map((item) => `<option value="${escapeHtml(item)}"></option>`).join('')}
        </datalist>
      </form>
    </div>
  `;
}

function wireMovementForm(form, config) {
  const itemsWrap = form.querySelector('[data-items]');
  const productSelect = form.querySelector('[name="productFamilyId"]');
  const quantityInput = form.querySelector('[name="quantityTotal"]');
  const totalPriceInput = form.querySelector('[name="totalPrice"]');
  const clientSelect = form.querySelector('[name="clientId"]');
  const executedBySelect = form.querySelector('[name="executedBy"]');
  const sellerOther = form.querySelector('[data-seller-other]');
  const commissionField = form.querySelector('[data-commission-field]');
  const allowPriceEdit = form.dataset.allowPriceEdit === '1';

  function addRow(prefill = {}) {
    const row = document.createElement('div');
    row.className = `split-row ${config.kind === 'order' ? 'order-row' : ''}`;

    const sizeOptions = ['<option value="">Talla</option>']
      .concat(SIZES.map((size) => `<option value="${size}" ${prefill.size === size ? 'selected' : ''}>${size}</option>`))
      .join('');

    row.innerHTML = `
      <label class="field mini">
        <span>Cantidad</span>
        <input name="rowQuantity" type="number" min="1" step="1" value="${prefill.quantity || 1}" required />
      </label>
      <label class="field mini">
        <span>Color</span>
        <select name="rowVariant" required></select>
      </label>
      <label class="field mini">
        <span>Talla</span>
        <select name="rowSize" ${config.kind === 'purchase' ? 'disabled' : ''}>${config.kind === 'purchase' ? '<option value="">No aplica</option>' : sizeOptions}</select>
      </label>
      ${config.kind === 'production' ? '' : `
      <label class="field mini">
        <span>Precio unitario</span>
        <input name="rowPrice" type="number" min="0" step="0.01" ${allowPriceEdit ? '' : 'readonly'} />
      </label>
      `}
      <button class="small-btn danger" type="button" data-remove-row>Eliminar</button>
    `;
    itemsWrap.appendChild(row);
    fillVariantOptions(row, prefill.variantId);
    if (row.querySelector('[name="rowPrice"]') && allowPriceEdit && prefill.unitPrice !== undefined) {
      row.querySelector('[name="rowPrice"]').value = prefill.unitPrice;
    }
    refreshTotals(form);
  }

  function fillVariantOptions(row, selectedVariantId = '') {
    const familyId = productSelect.value;
    const variants = variantsForFamily(familyId);
    const select = row.querySelector('[name="rowVariant"]');
    if (!variants.length) {
      select.innerHTML = '<option value="">No hay colores</option>';
      select.disabled = true;
      const priceInput = row.querySelector('[name="rowPrice"]');
      if (priceInput) priceInput.value = '';
      return;
    }
    select.disabled = false;
    select.innerHTML = variants
      .map(
        (variant) =>
          `<option value="${variant.id}" data-price="${variant.price}" ${String(variant.id) === String(selectedVariantId) ? 'selected' : ''}>${escapeHtml(
            variant.color
          )}</option>`
      )
      .join('');
    syncRowPrice(row);
  }

  function syncRowPrice(row) {
    const variantSelect = row.querySelector('[name="rowVariant"]');
    const selected = variantSelect.selectedOptions[0];
    const price = selected ? selected.dataset.price || 0 : 0;
    const priceInput = row.querySelector('[name="rowPrice"]');
    if (priceInput && (!allowPriceEdit || !priceInput.value)) priceInput.value = price;
    refreshTotals(form);
  }

  function refreshTotals() {
    const totalQty = Array.from(itemsWrap.querySelectorAll('[name="rowQuantity"]')).reduce(
      (sum, input) => sum + Number(input.value || 0),
      0
    );
    const totalPrice = Array.from(itemsWrap.querySelectorAll('.split-row')).reduce((sum, row) => {
      const qty = Number(row.querySelector('[name="rowQuantity"]').value || 0);
      const priceField = row.querySelector('[name="rowPrice"]');
      const price = priceField ? Number(priceField.value || 0) : 0;
      return sum + qty * price;
    }, 0);
    quantityInput.value = totalQty || '';
    if (totalPriceInput) {
      totalPriceInput.value = config.kind === 'production' ? '' : totalPrice ? totalPrice.toFixed(2) : '';
    }
  }

  function rebuildRowsFromState() {
    itemsWrap.innerHTML = '';
    addRow({ quantity: 1 });
  }

  productSelect.addEventListener('change', rebuildRowsFromState);
  form.addEventListener('click', (event) => {
    if (event.target.matches('[data-add-item]')) {
      event.preventDefault();
      addRow({ quantity: 1 });
    }
    if (event.target.matches('[data-fill-one]')) {
      event.preventDefault();
      itemsWrap.innerHTML = '';
      addRow({ quantity: Number(quantityInput.value || 1) || 1 });
    }
    if (event.target.matches('[data-reset-items]')) {
      event.preventDefault();
      rebuildRowsFromState();
    }
    if (event.target.matches('[data-remove-row]')) {
      event.preventDefault();
      const row = event.target.closest('.split-row');
      if (row) row.remove();
      if (!itemsWrap.children.length) addRow({ quantity: 1 });
      refreshTotals(form);
    }
  });

  form.addEventListener('input', (event) => {
    if (
      event.target.matches('[name="rowQuantity"]') ||
      event.target.matches('[name="rowPrice"]')
    ) {
      refreshTotals(form);
    }
  });

  form.addEventListener('change', (event) => {
    if (event.target.matches('[name="rowVariant"]')) {
      const row = event.target.closest('.split-row');
      const selected = event.target.selectedOptions[0];
      const priceInput = row.querySelector('[name="rowPrice"]');
      if (priceInput) {
        if (selected && !allowPriceEdit) {
          priceInput.value = selected.dataset.price || 0;
        } else if (selected && allowPriceEdit && !priceInput.value) {
          priceInput.value = selected.dataset.price || 0;
        }
      }
      refreshTotals(form);
    }
    if (event.target.matches('[name="executedBy"]')) {
      if (sellerOther && commissionField && event.target.tagName === 'SELECT') {
        const isOther = event.target.value === 'Otro';
        sellerOther.style.display = isOther ? 'grid' : 'none';
        commissionField.style.display = event.target.value === 'Rossell' ? 'none' : 'grid';
      }
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const kind = config.kind;
    const payload = buildMovementPayload(form, kind);
    if (!payload) return;
    try {
      const url = state.editing ? `/api/movements/${state.editing.id}` : '/api/movements';
      const method = state.editing ? 'PUT' : 'POST';
      await api(url, {
        method,
        body: JSON.stringify(payload),
      });
      showToast(state.editing ? 'Movimiento actualizado.' : 'Movimiento guardado.');
      state.editing = null;
      await refreshAll();
      renderRegisterForm('product');
      setSection('consult');
    } catch (error) {
      showToast(error.message);
    }
  });

  if (itemsWrap.children.length) {
    Array.from(itemsWrap.children).forEach((row) => {
      fillVariantOptions(row, row.dataset.variantId);
    });
  } else if (config.kind === 'production' || config.kind === 'sale' || config.kind === 'order') {
    itemsWrap.innerHTML = '';
    addRow({ quantity: 1 });
  }

  if (executedBySelect) {
    executedBySelect.addEventListener('change', () => {
      if (sellerOther && commissionField && executedBySelect.tagName === 'SELECT') {
        sellerOther.style.display = executedBySelect.value === 'Otro' ? 'grid' : 'none';
        commissionField.style.display = executedBySelect.value === 'Rossell' ? 'none' : 'grid';
      }
    });
  }

  if (clientSelect) {
    clientSelect.addEventListener('change', () => {});
  }
}

  function buildMovementPayload(form, kind) {
  const movementDate = form.elements.movementDate.value;
  const productFamilyId = form.elements.productFamilyId?.value || null;
  const family = state.products.find((item) => String(item.id) === String(productFamilyId));
  const totalPrice = form.elements.totalPrice ? Number(form.elements.totalPrice.value || 0) : 0;
  const totalQuantity = Number(form.elements.quantityTotal.value || 0);
  const observations = form.elements.observations?.value || '';

  if (!movementDate) {
    showToast('La fecha es obligatoria.');
    return null;
  }

  if (kind === 'purchase') {
    const materialName = form.elements.materialName.value.trim();
    const quantity = Number(form.elements.quantity.value || 0);
    const color = form.elements.color.value.trim();
    const location = form.elements.location.value.trim();
    const total = Number(form.elements.totalPrice.value || 0);
    if (!materialName || quantity <= 0 || total < 0) {
      showToast('Completa los datos de compra.');
      return null;
    }
    return {
      kind,
      movementDate,
      materialName,
      quantity,
      color,
      totalPrice: total,
      location,
      observations,
    };
  }

  const items = Array.from(form.querySelectorAll('.split-row')).map((row) => ({
    variantId: row.querySelector('[name="rowVariant"]').value,
    quantity: Number(row.querySelector('[name="rowQuantity"]').value || 0),
    color:
      row.querySelector('[name="rowVariant"]').selectedOptions[0]?.textContent?.trim() ||
      row.querySelector('[name="rowVariant"]').value,
    size: row.querySelector('[name="rowSize"]')?.value || '',
    unitPrice: row.querySelector('[name="rowPrice"]')
      ? Number(row.querySelector('[name="rowPrice"]').value || 0)
      : 0,
  }));

  const detailQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (!productFamilyId || !family) {
    showToast('Selecciona un producto valido.');
    return null;
  }
  if (!items.length || items.some((item) => !item.variantId || item.quantity <= 0 || !item.color)) {
    showToast('Completa las filas de detalle.');
    return null;
  }
  if (detailQuantity !== totalQuantity) {
    showToast('La suma de cantidades debe coincidir con la cantidad total.');
    return null;
  }
  if (kind !== 'production' && totalPrice <= 0) {
    showToast('El precio total debe ser mayor a cero.');
    return null;
  }

  const payload = {
    kind,
    movementDate,
    productFamilyId,
    productFamilyName: family.name,
    quantity: totalQuantity,
    totalPrice: kind === 'production' ? 0 : totalPrice,
    items,
    observations,
  };

  const executedBy = form.elements.executedBy?.value || 'Rossell';
  if (executedBy) payload.executedBy = executedBy === 'Otro' ? form.elements.executedByCustom.value.trim() : executedBy;
  if (executedBy && executedBy !== 'Rossell') {
    payload.commission = Number(form.elements.commission?.value || 0);
  }
  if (kind === 'order') {
    const clientId = form.elements.clientId?.value;
    if (clientId) payload.clientId = Number(clientId);
    payload.clientName = clientId ? state.clients.find((client) => String(client.id) === String(clientId))?.name : '';
  }

  return payload;
}

function handlePurchaseSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    kind: 'purchase',
    movementDate: String(data.get('movementDate') || '').trim(),
    materialName: String(data.get('materialName') || '').trim(),
    quantity: Number(data.get('quantity') || 0),
    color: String(data.get('color') || '').trim(),
    totalPrice: Number(data.get('totalPrice') || 0),
    location: String(data.get('location') || '').trim(),
    observations: String(data.get('observations') || '').trim(),
  };

  if (!payload.movementDate || !payload.materialName || payload.quantity <= 0 || payload.totalPrice < 0) {
    showToast('Completa los datos de compra.');
    return;
  }

  api('/api/movements', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then(async () => {
      showToast('Compra guardada.');
      state.activeConsultTab = 'purchase';
      await refreshAll({ renderConsult: false });
      document.querySelectorAll('.tab').forEach((el) => {
        el.classList.toggle('active', el.dataset.tab === state.activeConsultTab);
      });
      setSection('consult');
      renderConsultView();
    })
    .catch((error) => showToast(error.message));
}

function handleProductSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    familyName: form.elements.familyName.value.trim(),
    color: form.elements.color.value.trim(),
    price: Number(form.elements.price.value || 0),
  };
  if (!payload.familyName || !payload.color || payload.price < 0) {
    showToast('Completa nombre, color y precio.');
    return;
  }
  api('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then(async () => {
      showToast('Producto guardado.');
      await refreshAll();
      renderRegisterForm('product');
    })
    .catch((error) => showToast(error.message));
}

function handleClientSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    name: form.elements.name.value.trim(),
    ci: form.elements.ci.value.trim(),
    phone: form.elements.phone.value.trim(),
  };
  if (!payload.name) return showToast('El nombre del cliente es obligatorio.');
  api('/api/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then(async () => {
      showToast('Cliente guardado.');
      await refreshAll();
      renderRegisterForm('client');
    })
    .catch((error) => showToast(error.message));
}

function renderConsultView() {
  const requestId = ++state.consultRequestId;
  const tab = state.activeConsultTab;
  if (tab === 'sales') {
    api(`/api/movements?group=sales`)
      .then((rows) => {
        if (requestId !== state.consultRequestId) return;
        const filtered = state.saleFilter === 'all' ? rows : rows.filter((row) => row.kind === state.saleFilter);
        els.tableArea.innerHTML = renderMovementTable(filtered, 'sales');
      })
      .catch((error) => (els.tableArea.innerHTML = `<div class="card">${escapeHtml(error.message)}</div>`));
  } else if (tab === 'purchase') {
    api(`/api/movements?group=purchase`)
      .then((rows) => {
        if (requestId !== state.consultRequestId) return;
        els.tableArea.innerHTML = renderMovementTable(rows, 'purchase');
      })
      .catch((error) => (els.tableArea.innerHTML = `<div class="card">${escapeHtml(error.message)}</div>`));
  } else if (tab === 'production') {
    api(`/api/movements?group=production`)
      .then((rows) => {
        if (requestId !== state.consultRequestId) return;
        els.tableArea.innerHTML = renderMovementTable(rows, 'production');
      })
      .catch((error) => (els.tableArea.innerHTML = `<div class="card">${escapeHtml(error.message)}</div>`));
  }
}

function renderMovementTable(rows, mode) {
  const columns =
    mode === 'purchase'
      ? ['Fecha', 'Material', 'Cantidad', 'Color', 'Precio total', 'Lugar', 'Ejecutante', 'Acciones']
      : mode === 'production'
        ? ['Fecha', 'Producto', 'Cantidad', 'Color', 'Talla', 'Precio', 'Acciones']
        : ['Fecha', 'Tipo', 'Producto', 'Cantidad', 'Color', 'Talla', 'Precio', 'Cliente', 'Lugar', 'Ejecutante', 'Acciones'];

  const body = rows.length
    ? rows
        .map((row) => {
          const items = Array.isArray(row.items) ? row.items : [];
          const color = items.map((item) => `${item.color} x${item.quantity}`).join(' | ') || row.location || '';
          const talla = items.map((item) => `${item.size || '-'} x${item.quantity}`).join(' | ');
          const tipo = row.kind === 'sale' ? 'Venta' : row.kind === 'order' ? 'Pedido' : row.kind === 'purchase' ? 'Compra' : 'Produccion';
          const actions = `
            <div class="row-actions">
              <button class="small-btn" data-view-movement="${row.id}">Ficha</button>
              <button class="small-btn" data-edit-movement="${row.id}">Editar</button>
              <button class="small-btn danger" data-delete-movement="${row.id}">Eliminar</button>
            </div>
          `;

          if (mode === 'purchase') {
            return `
              <tr>
                <td>${formatDate(row.movement_date)}</td>
                <td>${escapeHtml(row.product_name_snapshot)}</td>
                <td>${row.quantity}</td>
                <td>${escapeHtml(color)}</td>
                <td>Bs ${money(row.total_price)}</td>
                <td>${escapeHtml(row.location || '')}</td>
                <td>${escapeHtml(row.executed_by || 'Rossell')}</td>
                <td>${actions}</td>
              </tr>
            `;
          }

          if (mode === 'production') {
            return `
              <tr>
                <td>${formatDate(row.movement_date)}</td>
                <td>${escapeHtml(row.product_name_snapshot)}</td>
                <td>${row.quantity}</td>
                <td>${escapeHtml(color)}</td>
                <td>${escapeHtml(talla)}</td>
                <td>${Number(row.total_price || 0) ? `Bs ${money(row.total_price)}` : '-'}</td>
                <td>${actions}</td>
              </tr>
            `;
          }

          return `
            <tr>
              <td>${formatDate(row.movement_date)}</td>
              <td><span class="pill">${tipo}</span></td>
              <td>${escapeHtml(row.product_name_snapshot)}</td>
              <td>${row.quantity}</td>
              <td>${escapeHtml(color)}</td>
              <td>${escapeHtml(talla)}</td>
              <td>Bs ${money(row.total_price)}</td>
              <td>${escapeHtml(row.client_name || row.client_name_snapshot || '')}</td>
              <td>${escapeHtml(row.location || '')}</td>
              <td>${escapeHtml(row.executed_by || 'Rossell')}</td>
              <td>${actions}</td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="${columns.length}" class="subtle">No hay registros todavia.</td></tr>`;

  return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderMovementDetail(movement) {
  const items = Array.isArray(movement.items) ? movement.items : [];
  return `
    <div class="modal-body">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Ficha completa</p>
          <h2>${escapeHtml(movement.product_name_snapshot)}</h2>
        </div>
        <button class="ghost" data-close-modal>Cerrar</button>
      </div>
      <div class="form-grid">
        <div class="card">
          <strong>Fecha</strong>
          <div class="subtle">${formatDate(movement.movement_date)}</div>
        </div>
        <div class="card">
          <strong>Tipo</strong>
          <div class="subtle">${movement.kind === 'purchase' ? 'compra de material' : escapeHtml(movement.kind)}</div>
        </div>
        <div class="card">
          <strong>Cantidad</strong>
          <div class="subtle">${movement.quantity}</div>
        </div>
        <div class="card">
          <strong>Precio total</strong>
          <div class="subtle">${movement.kind === 'production' && !Number(movement.total_price || 0) ? '-' : `Bs ${money(movement.total_price)}`}</div>
        </div>
        <div class="card full">
          <strong>Detalle de colores y tallas</strong>
          <div class="subtle" style="margin-top:8px;">
            ${items
              .map(
                (item) =>
                  `<div>${escapeHtml(item.color || '-')} x${item.quantity} ${item.size ? `- talla ${escapeHtml(item.size)}` : ''} ${item.unit_price ? `- Bs ${money(item.unit_price)}` : ''}</div>`
              )
              .join('') || 'Sin detalle'}
          </div>
        </div>
        <div class="card">
          <strong>Ejecutante</strong>
          <div class="subtle">${escapeHtml(movement.executed_by || 'Rossell')}</div>
        </div>
        <div class="card">
          <strong>Cliente</strong>
          <div class="subtle">${escapeHtml(movement.client_name || movement.client_name_snapshot || '')}</div>
        </div>
        <div class="card">
          <strong>Lugar</strong>
          <div class="subtle">${escapeHtml(movement.location || '')}</div>
        </div>
        <div class="card">
          <strong>Comision</strong>
          <div class="subtle">${movement.commission ? `Bs ${money(movement.commission)}` : '-'}</div>
        </div>
        <div class="card full">
          <strong>Observaciones</strong>
          <div class="subtle">${escapeHtml(movement.observations || '') || '-'}</div>
        </div>
      </div>
    </div>
  `;
}

function renderProductEditor(product) {
  const variant = product.variants[0] || {};
  return `
    <div class="modal-body">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Editar</p>
          <h2>Producto</h2>
        </div>
        <button class="ghost" data-close-modal>Cerrar</button>
      </div>
      <form class="form-grid" data-product-edit="${variant.id}">
        <label class="field full">
          <span>Nombre</span>
          <input name="familyName" value="${escapeHtml(product.name)}" required />
        </label>
        <label class="field">
          <span>Color</span>
          <input name="color" value="${escapeHtml(variant.color || '')}" required />
        </label>
        <label class="field">
          <span>Precio</span>
          <input name="price" type="number" min="0" step="0.01" value="${variant.price || 0}" required />
        </label>
        <div class="form-actions full">
          <button class="primary" type="submit">Guardar cambios</button>
        </div>
      </form>
    </div>
  `;
}

function renderClientEditor(client) {
  return `
    <div class="modal-body">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Editar</p>
          <h2>Cliente</h2>
        </div>
        <button class="ghost" data-close-modal>Cerrar</button>
      </div>
      <form class="form-grid" data-client-edit="${client.id}">
        <label class="field full">
          <span>Nombre</span>
          <input name="name" value="${escapeHtml(client.name)}" required />
        </label>
        <label class="field">
          <span>CI</span>
          <input name="ci" value="${escapeHtml(client.ci || '')}" />
        </label>
        <label class="field">
          <span>Telefono</span>
          <input name="phone" value="${escapeHtml(client.phone || '')}" />
        </label>
        <div class="form-actions full">
          <button class="primary" type="submit">Guardar cambios</button>
        </div>
      </form>
    </div>
  `;
}

function handleBodyClick(event) {
  if (event.target.matches('[data-close-modal]')) {
    closeModal();
    return;
  }

  const viewButton = event.target.closest('[data-view-movement]');
  if (viewButton) {
    api(`/api/movements/${viewButton.dataset.viewMovement}`)
      .then((movement) => openModal(renderMovementDetail(movement)))
      .catch((error) => showToast(error.message));
  }

  const editMovementButton = event.target.closest('[data-edit-movement]');
  if (editMovementButton) {
    api(`/api/movements/${editMovementButton.dataset.editMovement}`)
      .then((movement) => {
        state.editing = movement;
        openModal(renderMovementEditor(movement));
        const form = els.modalContent.querySelector('form');
        if (form) {
          wireMovementForm(form, {
            kind: movement.kind,
            allowClient: movement.kind === 'order',
            allowPriceEdit: movement.kind === 'order',
          });
        }
      })
      .catch((error) => showToast(error.message));
  }

  const deleteMovementButton = event.target.closest('[data-delete-movement]');
  if (deleteMovementButton) {
    const id = deleteMovementButton.dataset.deleteMovement;
    if (!confirm('Quieres eliminar este movimiento?')) return;
    api(`/api/movements/${id}`, { method: 'DELETE' })
      .then(async () => {
        showToast('Movimiento eliminado.');
        await refreshAll();
      })
      .catch((error) => showToast(error.message));
  }

  const productEdit = event.target.closest('[data-product-edit]');
  if (productEdit) {
    event.preventDefault();
    const id = productEdit.dataset.productEdit;
    const form = productEdit;
    api(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        familyName: form.elements.familyName.value.trim(),
        color: form.elements.color.value.trim(),
        price: Number(form.elements.price.value || 0),
      }),
    })
      .then(async () => {
        showToast('Producto actualizado.');
        closeModal();
        await refreshAll();
      })
      .catch((error) => showToast(error.message));
  }

  const clientEdit = event.target.closest('[data-client-edit]');
  if (clientEdit) {
    event.preventDefault();
    const id = clientEdit.dataset.clientEdit;
    const form = clientEdit;
    api(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: form.elements.name.value.trim(),
        ci: form.elements.ci.value.trim(),
        phone: form.elements.phone.value.trim(),
      }),
    })
      .then(async () => {
        showToast('Cliente actualizado.');
        closeModal();
        await refreshAll();
      })
      .catch((error) => showToast(error.message));
  }
}

function handleBodyInput(event) {
  if (event.target.matches('[data-date]')) {
    // handled by custom date picker
  }
}

function handleBodyChange(event) {
  if (event.target.matches('[data-date]')) {
    // handled by custom date picker
  }
}

function renderMovementEditor(movement) {
  const isPurchase = movement.kind === 'purchase';
  const items = Array.isArray(movement.items) ? movement.items : [];
  const familyOptionsMarkup = familyOptions(movement.product_family_id);
  const clientMarkup = clientOptions(movement.client_id || '');
  const date = movement.movement_date;
  const rowsMarkup = items.length
    ? items
        .map((item) => `
            <div class="split-row ${movement.kind === 'order' ? 'order-row' : ''}" data-variant-id="${escapeHtml(item.variant_id || '')}">
              <label class="field mini">
                <span>Cantidad</span>
                <input name="rowQuantity" type="number" min="1" step="1" value="${item.quantity}" required />
              </label>
              <label class="field mini">
                <span>Color</span>
                <select name="rowVariant" required></select>
              </label>
              <label class="field mini">
                <span>Talla</span>
                <select name="rowSize">${['<option value="">Talla</option>']
                  .concat(SIZES.map((size) => `<option value="${size}" ${item.size === size ? 'selected' : ''}>${size}</option>`))
                  .join('')}</select>
              </label>
              ${movement.kind === 'production' ? '' : `
              <label class="field mini">
                <span>Precio unitario</span>
                <input name="rowPrice" type="number" min="0" step="0.01" value="${item.unit_price}" />
              </label>
              `}
              <button class="small-btn danger" type="button" data-remove-row>Eliminar</button>
            </div>
          `)
        .join('')
    : '';

  return `
    <div class="modal-body">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Editar</p>
          <h2>${escapeHtml(movement.product_name_snapshot)}</h2>
        </div>
        <button class="ghost" data-close-modal>Cerrar</button>
      </div>
      <form class="form-grid" data-form-type="${movement.kind}" data-allow-price-edit="${movement.kind === 'order' ? '1' : '0'}" data-editing-id="${movement.id}">
        <div class="field">
          <span>Fecha</span>
          <div class="date-wrap">
            <input name="movementDate" class="date-input" data-date value="${date}" readonly required />
          </div>
        </div>
        <label class="field">
          <span>Producto</span>
          <select name="productFamilyId" required>${familyOptionsMarkup}</select>
        </label>
        ${movement.kind === 'order' ? `
          <label class="field full">
            <span>Cliente</span>
            <select name="clientId">${clientMarkup}</select>
          </label>
        ` : ''}
        ${movement.kind !== 'purchase' ? `
          <label class="field">
            <span>Ejecutante</span>
            <input name="executedBy" value="${escapeHtml(movement.executed_by || 'Rossell')}" />
          </label>
        ` : ''}
        ${movement.kind !== 'production' && movement.kind !== 'purchase' ? `
          <label class="field">
            <span>Comision</span>
            <input name="commission" type="number" min="0" step="0.01" value="${movement.commission || ''}" />
          </label>
        ` : ''}
        ${movement.kind === 'purchase' ? `
          <label class="field">
            <span>Material</span>
            <input name="materialName" value="${escapeHtml(movement.product_name_snapshot)}" required />
          </label>
          <label class="field">
            <span>Cantidad</span>
            <input name="quantity" type="number" min="1" step="1" value="${movement.quantity}" required />
          </label>
          <label class="field">
            <span>Color</span>
            <input name="color" value="${escapeHtml(items[0]?.color || '')}" />
          </label>
          <label class="field">
            <span>Precio total</span>
            <input name="totalPrice" type="number" min="0" step="0.01" value="${movement.total_price}" required />
          </label>
          <label class="field">
            <span>Lugar</span>
            <input name="location" list="location-list" value="${escapeHtml(movement.location || '')}" />
          </label>
        ` : `
          <div class="field full">
            <span>Detalles</span>
            <div class="split-rows" data-items>${rowsMarkup}</div>
            <div class="secondary-actions" style="margin-top:12px;">
              <button class="ghost" type="button" data-add-item>Agregar fila</button>
            </div>
          </div>
          <label class="field">
            <span>Cantidad total</span>
            <input name="quantityTotal" type="number" min="1" step="1" value="${movement.quantity}" required />
          </label>
          ${movement.kind === 'production' ? '' : `
          <label class="field">
            <span>Precio total</span>
            <input name="totalPrice" type="number" min="0" step="0.01" value="${movement.total_price}" required />
          </label>
          `}
        `}
        <label class="field full">
          <span>Observaciones</span>
          <textarea name="observations">${escapeHtml(movement.observations || '')}</textarea>
        </label>
        <div class="form-actions full">
          <button class="primary" type="submit">Guardar cambios</button>
        </div>
      </form>
    </div>
  `;
}

function initDatePickers(root = document) {
  root.querySelectorAll('[data-date]').forEach((input) => {
    if (input.dataset.pickerReady === '1') return;
    input.dataset.pickerReady = '1';
    const wrapper = input.closest('.date-wrap') || input.parentElement;
    wrapper.classList.add('date-wrap');
    input.value = input.value || todayISO();
    input.addEventListener('click', () => openCalendar(input));
    input.addEventListener('focus', () => openCalendar(input));
  });
}

function openCalendar(input) {
  closeExistingCalendar();
  const current = input.value ? new Date(`${input.value}T00:00:00`) : new Date();
  let month = current.getMonth();
  let year = current.getFullYear();

  const calendar = document.createElement('div');
  calendar.className = 'calendar-pop';
  calendar.innerHTML = `
    <div class="calendar-head">
      <button class="small-btn" type="button" data-prev-month>◀</button>
      <strong data-month-label></strong>
      <button class="small-btn" type="button" data-next-month>▶</button>
    </div>
    <div class="calendar-grid">
      ${['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((day) => `<div class="calendar-weekday">${day}</div>`).join('')}
    </div>
  `;
  input.closest('.date-wrap').appendChild(calendar);

  const monthLabel = calendar.querySelector('[data-month-label]');

  function renderCalendar() {
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    monthLabel.textContent = new Intl.DateTimeFormat('es-BO', {
      month: 'long',
      year: 'numeric',
    }).format(first);
    calendar.querySelectorAll('.calendar-day').forEach((node) => node.remove());
    const grid = calendar.querySelector('.calendar-grid');
    const totalCells = 42;
    for (let i = 0; i < totalCells; i += 1) {
      const day = i - startDay + 1;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-day';
      if (i < startDay || day > daysInMonth) {
        cell.classList.add('empty');
        cell.textContent = '';
      } else {
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cell.textContent = String(day);
        cell.dataset.iso = iso;
        const today = todayISO();
        if (iso === today) cell.classList.add('today');
        if (input.value === iso) cell.classList.add('selected');
        cell.addEventListener('click', () => {
          input.value = iso;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          closeExistingCalendar();
        });
      }
      grid.appendChild(cell);
    }
  }

  calendar.querySelector('[data-prev-month]').addEventListener('click', () => {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    renderCalendar();
  });
  calendar.querySelector('[data-next-month]').addEventListener('click', () => {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    renderCalendar();
  });

  renderCalendar();
  input.dataset.calendarOpen = '1';
}

function closeExistingCalendar() {
  document.querySelectorAll('.calendar-pop').forEach((node) => node.remove());
}

async function refreshAll({ renderConsult = true } = {}) {
  const [dashboard, bootstrap] = await Promise.all([
    api('/api/dashboard'),
    api('/api/bootstrap'),
  ]);
  state.dashboard = dashboard;
  state.products = bootstrap.products;
  state.clients = bootstrap.clients;
  renderDashboard();
  renderSidebar();
  if (renderConsult) renderConsultView();
  initDatePickers();
}

async function handleExport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const from = form.elements.from.value;
  const to = form.elements.to.value;
  if (!from || !to) {
    showToast('Selecciona ambas fechas.');
    return;
  }
  const url = `/api/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  window.location.href = url;
  showToast('Preparando descarga...');
}

async function boot() {
  basePage();
  initDatePickers();
  document.querySelector('#export-form [name="from"]').value = todayISO();
  document.querySelector('#export-form [name="to"]').value = todayISO();
  renderRegisterForm('product');
  await refreshAll();
  setSection('register');
  showToast('Sistema listo.');
}

boot().catch((error) => {
  console.error(error);
  showToast(error.message);
});
