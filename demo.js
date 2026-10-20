(() => {
  'use strict';

  const realFetch = window.fetch.bind(window);
  const now = new Date();
  const at = (daysAgo, hour = 10, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const todayKey = (iso) => String(iso).slice(0, 10);
  const monthKey = (iso) => String(iso).slice(0, 7);
  const round = (n) => Math.round(n);

  const ROLE_PERMISSIONS = {
    owner: ['*'],
    buyer: [
      'catalog.view', 'catalog.manage', 'suppliers.view', 'suppliers.manage',
      'purchase.view', 'purchase.create', 'purchase.edit', 'purchase.status', 'purchase.payments',
      'receipt.view', 'cost.view', 'stock.view', 'reports.purchases',
      'export.catalog', 'export.stock', 'export.purchases',
    ],
    admin: [
      'catalog.view', 'suppliers.view', 'purchase.view', 'receipt.view', 'stock.view',
      'reports.purchases', 'export.stock', 'export.purchases',
    ],
    seller: ['catalog.view', 'stock.view', 'sale.create', 'sale.view_own', 'return.create', 'reports.sales_own'],
  };

  const DEMO_ACCOUNTS = {
    owner: { password: 'Owner#2026', user: { id: 1, login: 'owner', fullName: 'Анна Смирнова', role: 'owner', roleLabel: 'Владелец' } },
    buyer: { password: 'Buyer#2026', user: { id: 2, login: 'buyer', fullName: 'Ли Вэй', role: 'buyer', roleLabel: 'Закупщик' } },
    admin: { password: 'Admin#2026', user: { id: 4, login: 'admin', fullName: 'Администратор', role: 'admin', roleLabel: 'Администратор' } },
    seller: { password: 'Seller#2026', user: { id: 3, login: 'seller', fullName: 'Мария Иванова', role: 'seller', roleLabel: 'Продавец' } },
  };

  const SESSION_KEY = 'sk_demo_role';
  let sessionRole = null;
  try { sessionRole = sessionStorage.getItem(SESSION_KEY); } catch { sessionRole = null; }
  if (sessionRole && !DEMO_ACCOUNTS[sessionRole]) sessionRole = null;

  function currentUser() {
    const account = sessionRole ? DEMO_ACCOUNTS[sessionRole] : null;
    if (!account) return null;
    const permissions = ROLE_PERMISSIONS[account.user.role] || [];
    return { ...account.user, permissions };
  }

  function can(permission) {
    const user = currentUser();
    if (!user) return false;
    return user.permissions.includes('*') || user.permissions.includes(permission);
  }

  function setSession(role) {
    sessionRole = role;
    try { sessionStorage.setItem(SESSION_KEY, role); } catch { /* приватный режим */ }
  }

  function clearSession() {
    sessionRole = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* приватный режим */ }
  }

  const settings = {
    company_name: 'Stockroom Kids',
    low_stock_threshold: 3,
    max_seller_discount_percent: 10,
    currency: 'RUB',
    purchase_note: 'Проверять размерную сетку перед заказом',
  };

  const categories = [
    { id: 1, name: 'Детская одежда', sort: 1, isActive: true },
    { id: 2, name: 'Детская обувь', sort: 2, isActive: true },
    { id: 3, name: 'Нижнее бельё', sort: 3, isActive: true },
    { id: 4, name: 'Канцтовары', sort: 4, isActive: true },
    { id: 5, name: 'Украшения и аксессуары', sort: 5, isActive: true },
    { id: 6, name: 'Детская косметика', sort: 6, isActive: true },
  ];

  const suppliers = [
    { id: 1, name: 'Yiwu Kids Trade', code: 'YIWU-17', country: 'Китай', contact: 'WeChat: kids_trade', notes: 'Куртки, футболки', isActive: true, createdAt: at(120) },
    { id: 2, name: 'Guangzhou Little Star', code: 'GZ-42', country: 'Китай', contact: '+86 138 0000 00', notes: 'Обувь и аксессуары', isActive: true, createdAt: at(90) },
    { id: 3, name: 'ИП Смирнова', code: 'RU-8', country: 'Россия', contact: '+7 900 000-00-00', notes: 'Колготки, канцтовары', isActive: true, createdAt: at(60) },
  ];

  const users = [
    { id: 1, login: 'owner', fullName: 'Анна Смирнова', role: 'owner', isActive: true, createdAt: at(200), lastLoginAt: at(0, 9, 30), sessionsCount: 1 },
    { id: 2, login: 'buyer', fullName: 'Ли Вэй', role: 'buyer', isActive: true, createdAt: at(150), lastLoginAt: at(1, 18, 10), sessionsCount: 0 },
    { id: 3, login: 'seller', fullName: 'Мария Иванова', role: 'seller', isActive: true, createdAt: at(140), lastLoginAt: at(0, 8, 55), sessionsCount: 1 },
  ];

  const roles = { owner: 'Владелец', buyer: 'Закупщик', seller: 'Продавец' };
  const expenseCategories = {
    delivery: 'Доставка', agent: 'Услуги посредника', packaging: 'Упаковка', customs: 'Таможенные расходы', other: 'Прочие расходы',
  };
  const allocationMethods = {
    value: 'Пропорционально стоимости', qty: 'Пропорционально количеству', manual: 'Вручную по позициям',
  };
  const purchaseStatusLabel = {
    draft: 'Черновик', pending_approval: 'На согласовании', approved: 'Утверждена', ordered: 'Заказана',
    partially_paid: 'Частично оплачена', paid: 'Оплачена', partially_received: 'Частично получена',
    received: 'Получена', cancelled: 'Отменена',
  };
  const movementTypes = {
    receipt: 'Приход', sale: 'Продажа', sale_return: 'Возврат от покупателя',
    writeoff: 'Списание', inventory: 'Инвентаризация', adjustment: 'Корректировка',
  };

  const db = {
    products: [], variants: [], stock: new Map(), priceHistory: [],
    purchases: [], purchaseItems: [], payments: [], receipts: [], receiptItems: [],
    expenses: [], movements: [], sales: [], saleItems: [], returns: [], returnItems: [],
    inventory: [], inventoryItems: [], audit: [],
  };

  let idSeq = 1000;
  const nextId = () => { idSeq += 1; return idSeq; };
  let variantSeq = 100;
  let movementSeq = 1;
  let auditSeq = 1;
  let saleSeq = 0;
  let returnSeq = 0;

  const productDefs = [
    {
      sku: 'JK-025', name: 'Куртка детская зимняя', categoryId: 1, season: 'осень-зима', ageGroup: '3–7 лет',
      brand: 'Little Fox', defaultSupplierId: 1, description: 'Тёплая куртка с капюшоном, утеплитель 250 г, водоотталкивающая ткань.',
      variants: [['98', 'чёрный', 4590], ['104', 'чёрный', 4590], ['110', 'чёрный', 4790], ['98', 'бежевый', 4590], ['104', 'бежевый', 4590]],
    },
    {
      sku: 'SH-014', name: 'Кроссовки детские', categoryId: 2, season: 'весна-осень', brand: 'Step Up',
      defaultSupplierId: 2, description: 'Лёгкие кроссовки на липучках, амортизирующая подошва.',
      variants: [['28', 'белый', 2990], ['29', 'белый', 2990], ['30', 'синий', 3090]],
    },
    {
      sku: 'TS-101', name: 'Футболка «Мишка»', categoryId: 1, season: 'лето', brand: 'Little Fox', defaultSupplierId: 1,
      description: 'Хлопок 100%, принт с мишкой.',
      variants: [['104', 'белый', 890], ['110', 'белый', 890], ['116', 'жёлтый', 890]],
    },
    {
      sku: 'LG-007', name: 'Колготки детские', categoryId: 3, brand: 'Тёплый дом', defaultSupplierId: 3,
      description: 'Плотные колготки с хлопком.',
      variants: [['98–104', 'бежевый', 490], ['110–116', 'бежевый', 490]],
    },
    {
      sku: 'NB-220', name: 'Тетрадь 12 листов', categoryId: 4, brand: 'Школа', defaultSupplierId: 3,
      description: 'Тетрадь в клетку, обложка с рисунком.',
      variants: [['', '', 45]],
    },
    {
      sku: 'AC-033', name: 'Заколки «Бабочки», набор', categoryId: 5, brand: 'Sunny', defaultSupplierId: 2,
      description: 'Набор из 6 заколок.',
      variants: [['', 'розовый', 290]],
    },
  ];

  const variantBySkuSizeColor = new Map();

  productDefs.forEach((def, index) => {
    const productId = nextId();
    const createdAt = at(40 - index * 3);
    db.products.push({
      id: productId, sku: def.sku, name: def.name, categoryId: def.categoryId, unit: 'шт',
      season: def.season || null, ageGroup: def.ageGroup || null, brand: def.brand || null,
      defaultSupplierId: def.defaultSupplierId || null, description: def.description || null, notes: null,
      photo: null, isActive: true, createdAt, updatedAt: at(1 + index),
    });
    def.variants.forEach(([size, color, price]) => {
      variantSeq += 1;
      const variant = {
        id: variantSeq, productId, size, color, styleName: '', extra: '',
        retailPriceKop: round(price * 100), isActive: true,
      };
      db.variants.push(variant);
      db.stock.set(variant.id, { qty: 0, avgCostX10000: 0 });
      variantBySkuSizeColor.set(`${def.sku}|${size}|${color}`, variant.id);
    });
  });

  const productById = (id) => db.products.find((p) => p.id === Number(id));
  const variantById = (id) => db.variants.find((v) => v.id === Number(id));
  const stockOf = (variantId) => db.stock.get(Number(variantId)) || { qty: 0, avgCostX10000: 0 };
  const supplierName = (id) => (suppliers.find((s) => s.id === Number(id)) || {}).name || '';
  const categoryName = (id) => (categories.find((c) => c.id === Number(id)) || {}).name || null;
  const userName = (id) => (users.find((u) => u.id === Number(id)) || {}).fullName || '';

  function addMovement({ variantId, type, qty, unitCostX10000, valueKop, docType, docId, comment, at: when, authorId }) {
    const state = stockOf(variantId);
    const newQty = state.qty + qty;
    let avg = state.avgCostX10000;
    const cost = unitCostX10000 == null ? avg : unitCostX10000;
    if (type === 'receipt') {
      const totalOld = state.qty * state.avgCostX10000;
      const totalNew = round(valueKop) * 10000;
      avg = newQty > 0 ? round((totalOld + totalNew) / newQty) : avg;
    }
    db.stock.set(variantId, { qty: newQty, avgCostX10000: avg });
    db.movements.push({
      id: movementSeq++, variantId, type, qty,
      unitCostX10000: cost,
      valueKop: valueKop == null ? round((cost * qty) / 10000) : valueKop,
      docType, docId, comment, createdAt: when, authorId: authorId || 1,
    });
  }

  function addAudit(action, entity, entityId, details, when, userId = 1) {
    db.audit.push({
      id: auditSeq++, at: when, login: userName(userId), userId, action, entity, entityId, details: details || null,
    });
  }

  function makePurchase({ number, supplierId, rateX10000, rateDate, status, createdAt, items, received, payment, expenses }) {
    const purchaseId = nextId();
    db.purchases.push({
      id: purchaseId, number, supplierId, currency: 'CNY', rateX10000, rateDate, rateSource: 'ручной ввод',
      status, authorId: 2, createdAt, updatedAt: createdAt,
      approvedAt: status !== 'draft' ? createdAt : null, approvedBy: 1,
      cancelledAt: null, cancelReason: null, comment: null,
    });
    const created = items.map((item, index) => {
      const line = {
        id: nextId(), purchaseId, variantId: item.variantId, qty: item.qty,
        priceCnyFen: item.priceCnyFen, lineNo: index + 1,
      };
      db.purchaseItems.push(line);
      return line;
    });
    addAudit('purchase.create', 'purchase', purchaseId, { number, items: created.length }, createdAt, 2);
    addAudit('purchase.status', 'purchase', purchaseId, { from: 'draft', to: status }, createdAt, 1);

    if (received) {
      const receiptId = nextId();
      const receiptNumber = `RCP-${String(db.receipts.length + 1).padStart(5, '0')}`;
      db.receipts.push({
        id: receiptId, number: receiptNumber, purchaseId, receiptDate: received.at,
        status: 'posted', authorId: 1, postedAt: received.at, comment: null,
      });
      received.lines.forEach((line) => {
        const poLine = created.find((l) => l.variantId === line.variantId);
        const qty = line.qty;
        const goods = round((poLine.priceCnyFen * qty * rateX10000) / 10000);
        const expensePart = (expenses || []).reduce((acc, e) => acc + (e.line === line.variantId ? e.amountKop : 0), 0);
        const total = goods + expensePart;
        const unit = qty > 0 ? round((total * 10000) / qty) : 0;
        const receiptItemId = nextId();
        db.receiptItems.push({
          id: receiptItemId, receiptId, poItemId: poLine.id, qtyReceived: qty, qtyDamaged: 0,
          unitCostX10000: unit, costTotalKop: total,
        });
        addMovement({
          variantId: line.variantId, type: 'receipt', qty, unitCostX10000: unit, valueKop: total,
          docType: 'receipt', docId: receiptId, comment: `Приёмка ${receiptNumber}`, at: received.at, authorId: 1,
        });
      });
      (expenses || []).forEach((e) => {
        db.expenses.push({
          id: nextId(), purchaseId, receiptId, category: e.category, amountKop: e.amountKop, currency: 'RUB',
          amountMinor: e.amountKop, rateX10000: 10000, method: 'value', comment: e.comment || null,
          isCapitalized: true, appliedAt: received.at, createdAt: createdAt, authorId: 1,
        });
      });
      addAudit('receipt.post', 'receipt', receiptId, { number: receiptNumber }, received.at, 1);
    }

    if (payment) {
      db.payments.push({
        id: nextId(), purchaseId, currency: 'RUB', amountMinor: payment.amountKop, rateX10000: 10000,
        amountKop: payment.amountKop, paidAt: payment.at, comment: null, authorId: 1,
      });
    }
    return purchaseId;
  }

  const jk = (size, color) => variantBySkuSizeColor.get(`JK-025|${size}|${color}`);
  const sh = (size, color) => variantBySkuSizeColor.get(`SH-014|${size}|${color}`);
  const ts = (size, color) => variantBySkuSizeColor.get(`TS-101|${size}|${color}`);

  const po1 = makePurchase({
    number: 'PO-00001', supplierId: 1, rateX10000: 118000, rateDate: at(12), status: 'received', createdAt: at(12),
    items: [
      { variantId: jk('98', 'чёрный'), qty: 10, priceCnyFen: 9500 },
      { variantId: jk('104', 'чёрный'), qty: 10, priceCnyFen: 9500 },
      { variantId: jk('110', 'чёрный'), qty: 10, priceCnyFen: 9800 },
      { variantId: jk('98', 'бежевый'), qty: 8, priceCnyFen: 9500 },
      { variantId: jk('104', 'бежевый'), qty: 8, priceCnyFen: 9500 },
    ],
    received: {
      at: at(10),
      lines: [
        { variantId: jk('98', 'чёрный'), qty: 10 }, { variantId: jk('104', 'чёрный'), qty: 10 },
        { variantId: jk('110', 'чёрный'), qty: 10 }, { variantId: jk('98', 'бежевый'), qty: 8 },
        { variantId: jk('104', 'бежевый'), qty: 8 },
      ],
    },
    expenses: [{ category: 'delivery', amountKop: 750000, line: jk('98', 'чёрный'), comment: 'Доставка партии' }],
    payment: { amountKop: 3000000, at: at(11) },
  });

  const po2 = makePurchase({
    number: 'PO-00002', supplierId: 2, rateX10000: 119500, rateDate: at(7), status: 'partially_received', createdAt: at(7),
    items: [
      { variantId: sh('28', 'белый'), qty: 8, priceCnyFen: 8800 },
      { variantId: sh('29', 'белый'), qty: 8, priceCnyFen: 8800 },
      { variantId: sh('30', 'синий'), qty: 8, priceCnyFen: 9000 },
    ],
    received: {
      at: at(5),
      lines: [
        { variantId: sh('28', 'белый'), qty: 4 }, { variantId: sh('29', 'белый'), qty: 4 }, { variantId: sh('30', 'синий'), qty: 4 },
      ],
    },
    expenses: [{ category: 'agent', amountKop: 320000, line: sh('28', 'белый'), comment: 'Комиссия посредника' }],
    payment: { amountKop: 1500000, at: at(6) },
  });

  const po3 = makePurchase({
    number: 'PO-00003', supplierId: 1, rateX10000: 121000, rateDate: at(2), status: 'ordered', createdAt: at(2),
    items: [
      { variantId: ts('104', 'белый'), qty: 20, priceCnyFen: 2200 },
      { variantId: ts('110', 'белый'), qty: 20, priceCnyFen: 2200 },
      { variantId: ts('116', 'жёлтый'), qty: 20, priceCnyFen: 2200 },
    ],
  });

  function saleNumber(index) {
    return `SL-${monthKey(now.toISOString()).replace('-', '')}-${String(index).padStart(4, '0')}`;
  }

  function createSaleFixture({ at: when, sellerId, items, discountKop = 0 }) {
    const saleId = nextId();
    saleSeq += 1;
    const lines = items.map((item) => {
      const variant = variantById(item.variantId);
      const state = stockOf(item.variantId);
      const priceKop = item.priceKop != null ? item.priceKop : variant.retailPriceKop;
      const costUnit = state.avgCostX10000;
      const costTotal = round((costUnit * item.qty) / 10000);
      const line = {
        id: nextId(), saleId, variantId: item.variantId, qty: item.qty, priceKop,
        costUnitX10000: costUnit, costTotalKop: costTotal,
      };
      db.saleItems.push(line);
      addMovement({
        variantId: item.variantId, type: 'sale', qty: -item.qty, unitCostX10000: costUnit,
        docType: 'sale', docId: saleId, comment: `Продажа ${saleNumber(saleSeq)}`, at: when, authorId: sellerId,
      });
      return line;
    });
    const subtotal = lines.reduce((acc, l) => acc + l.priceKop * l.qty, 0);
    const costTotal = lines.reduce((acc, l) => acc + l.costTotalKop, 0);
    db.sales.push({
      id: saleId, number: saleNumber(saleSeq), soldAt: when, sellerId, subtotalKop: subtotal,
      discountKop, totalKop: subtotal - discountKop, costTotalKop: costTotal, comment: null, status: 'posted',
    });
    addAudit('sale.create', 'sale', saleId, { number: saleNumber(saleSeq), total: subtotal - discountKop }, when, sellerId);
    return saleId;
  }

  const sale1 = createSaleFixture({ at: at(6, 12, 15), sellerId: 3, items: [{ variantId: jk('98', 'чёрный'), qty: 1 }, { variantId: jk('104', 'чёрный'), qty: 1 }] });
  const sale2 = createSaleFixture({ at: at(4, 16, 40), sellerId: 3, items: [{ variantId: sh('29', 'белый'), qty: 1 }] });
  const sale3 = createSaleFixture({ at: at(2, 11, 5), sellerId: 1, items: [{ variantId: jk('110', 'чёрный'), qty: 1 }] });
  const sale4 = createSaleFixture({ at: at(1, 17, 25), sellerId: 3, items: [{ variantId: sh('28', 'белый'), qty: 1 }] });
  const sale5 = createSaleFixture({ at: at(0, 11, 20), sellerId: 3, items: [{ variantId: jk('104', 'бежевый'), qty: 1 }] });

  const ret1 = nextId();
  returnSeq += 1;
  const sale1Item = db.saleItems.find((i) => i.saleId === sale1);
  db.returns.push({
    id: ret1, number: 'RET-00001', saleId: sale1, reason: 'Не подошёл размер', totalKop: sale1Item.priceKop,
    status: 'posted', createdAt: at(3, 13, 10), authorId: 3,
  });
  db.returnItems.push({
    id: nextId(), returnId: ret1, saleItemId: sale1Item.id, variantId: sale1Item.variantId,
    qty: 1, priceKop: sale1Item.priceKop, condition: 'sellable', costUnitX10000: sale1Item.costUnitX10000,
  });
  addMovement({
    variantId: sale1Item.variantId, type: 'sale_return', qty: 1, unitCostX10000: sale1Item.costUnitX10000,
    docType: 'return', docId: ret1, comment: 'Возврат RET-00001', at: at(3, 13, 10), authorId: 3,
  });
  addAudit('return.create', 'return', ret1, { number: 'RET-00001' }, at(3, 13, 10), 3);

  const inv1 = nextId();
  db.inventory.push({
    id: inv1, number: 'INV-00001', countedAt: at(1, 18, 0), status: 'draft', authorId: 1,
    postedAt: null, comment: 'Плановая проверка склада',
  });
  [jk('98', 'чёрный'), jk('104', 'чёрный'), sh('29', 'белый')].forEach((variantId) => {
    db.inventoryItems.push({
      id: nextId(), countId: inv1, variantId,
      qtyExpected: stockOf(variantId).qty,
      qtyActual: Math.max(stockOf(variantId).qty - 1, 0),
      comment: null,
    });
  });

  addMovement({
    variantId: sh('30', 'синий'), type: 'writeoff', qty: -1, unitCostX10000: stockOf(sh('30', 'синий')).avgCostX10000,
    docType: 'adjustment', docId: null, comment: 'Повреждение при транспортировке', at: at(5, 19, 0), authorId: 1,
  });
  addAudit('stock.adjust', 'variant', sh('30', 'синий'), { delta: -1, reason: 'Повреждение' }, at(5, 19, 0), 1);
  addAudit('auth.login', 'user', 1, { ip: '127.0.0.1' }, at(0, 9, 30), 1);
  addAudit('auth.login', 'user', 3, { ip: '127.0.0.1' }, at(0, 8, 55), 3);

  db.priceHistory.push({
    id: nextId(), variantId: jk('110', 'чёрный'), oldPriceKop: 439000, newPriceKop: 479000,
    changedAt: at(15, 12, 0), changedBy: 1, comment: 'Новая партия дороже',
  });

  function poItems(purchaseId) {
    const rows = db.purchaseItems.filter((i) => i.purchaseId === Number(purchaseId));
    return rows.map((item) => {
      const variant = variantById(item.variantId);
      const product = productById(variant.productId);
      const received = db.receiptItems
        .filter((ri) => ri.poItemId === item.id && (db.receipts.find((r) => r.id === ri.receiptId) || {}).status === 'posted')
        .reduce((acc, ri) => acc + ri.qtyReceived, 0);
      const damaged = db.receiptItems
        .filter((ri) => ri.poItemId === item.id && (db.receipts.find((r) => r.id === ri.receiptId) || {}).status === 'posted')
        .reduce((acc, ri) => acc + ri.qtyDamaged, 0);
      return {
        id: item.id, variantId: item.variantId, sku: product.sku, productName: product.name,
        size: variant.size, color: variant.color, styleName: variant.styleName,
        qty: item.qty, priceCnyFen: item.priceCnyFen, valueKop: 0,
        receivedQty: received, damagedQty: damaged,
        shortage: Math.max(item.qty - received, 0), surplus: Math.max(received - item.qty, 0),
        inTransit: Math.max(item.qty - received, 0),
      };
    });
  }

  function poTotals(purchase) {
    const items = poItems(purchase.id);
    const cnyFen = items.reduce((acc, i) => acc + i.priceCnyFen * i.qty, 0);
    const goodsKop = items.reduce((acc, i) => acc + round((i.priceCnyFen * i.qty * purchase.rateX10000) / 10000), 0);
    const receivedValueKop = items.reduce((acc, i) => acc + round((i.priceCnyFen * i.receivedQty * purchase.rateX10000) / 10000), 0);
    const expensesKop = db.expenses.filter((e) => e.purchaseId === purchase.id).reduce((acc, e) => acc + e.amountKop, 0);
    const paidKop = db.payments.filter((p) => p.purchaseId === purchase.id).reduce((acc, p) => acc + p.amountKop, 0);
    const orderedQty = items.reduce((acc, i) => acc + i.qty, 0);
    const receivedQty = items.reduce((acc, i) => acc + i.receivedQty, 0);
    return {
      cnyFen, goodsKop, receivedValueKop, expensesKop, paidKop,
      paymentsCount: db.payments.filter((p) => p.purchaseId === purchase.id).length,
      orderedQty, receivedQty, inTransitQty: Math.max(orderedQty - receivedQty, 0),
      unitCostKop: receivedQty > 0 ? round((receivedValueKop + expensesKop) / receivedQty) : 0,
    };
  }

  function purchaseView(purchase) {
    const totals = poTotals(purchase);
    return {
      id: purchase.id, number: purchase.number, supplierName: supplierName(purchase.supplierId),
      status: purchase.status, statusLabel: purchaseStatusLabel[purchase.status], currency: purchase.currency,
      rateX10000: purchase.rateX10000, createdAt: purchase.createdAt, authorName: userName(purchase.authorId),
      itemsCount: poItems(purchase.id).length, orderedQty: totals.orderedQty, receivedQty: totals.receivedQty,
      inTransitQty: totals.inTransitQty, cnyFen: totals.cnyFen, goodsKop: totals.goodsKop,
      paidKop: totals.paidKop, expensesKop: totals.expensesKop, comment: purchase.comment,
    };
  }

  function purchaseDetail(purchase) {
    const items = poItems(purchase.id);
    const totals = poTotals(purchase);
    const receipts = db.receipts.filter((r) => r.purchaseId === purchase.id).map((r) => ({
      id: r.id, number: r.number, receiptDate: r.receiptDate, status: r.status,
      authorName: userName(r.authorId), postedAt: r.postedAt,
      linesCount: db.receiptItems.filter((ri) => ri.receiptId === r.id).length,
      qty: db.receiptItems.filter((ri) => ri.receiptId === r.id).reduce((acc, ri) => acc + ri.qtyReceived, 0),
    }));
    const payments = db.payments.filter((p) => p.purchaseId === purchase.id).map((p) => ({
      id: p.id, currency: p.currency, amountMinor: p.amountMinor, rateX10000: p.rateX10000,
      amountKop: p.amountKop, paidAt: p.paidAt, comment: p.comment, authorName: userName(p.authorId),
    }));
    const expenses = db.expenses.filter((e) => e.purchaseId === purchase.id).map((e) => ({
      id: e.id, category: e.category, amountKop: e.amountKop, currency: e.currency, amountMinor: e.amountMinor,
      rateX10000: e.rateX10000, method: e.method, comment: e.comment, receiptId: e.receiptId,
      isCapitalized: e.isCapitalized, appliedAt: e.appliedAt, createdAt: e.createdAt, authorName: userName(e.authorId),
    }));
    const history = db.audit
      .filter((a) => a.entity === 'purchase' && Number(a.entityId) === purchase.id)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .map((a) => ({ id: a.id, at: a.at, action: a.action, login: a.login, details: a.details }));
    return {
      id: purchase.id, number: purchase.number, supplierId: purchase.supplierId,
      supplierName: supplierName(purchase.supplierId), currency: purchase.currency,
      rateX10000: purchase.rateX10000, rateDate: purchase.rateDate, rateSource: purchase.rateSource,
      status: purchase.status, statusLabel: purchaseStatusLabel[purchase.status],
      authorId: purchase.authorId, authorName: userName(purchase.authorId),
      createdAt: purchase.createdAt, updatedAt: purchase.updatedAt, approvedAt: purchase.approvedAt,
      cancelledAt: purchase.cancelledAt, cancelReason: purchase.cancelReason, comment: purchase.comment,
      items, totals, payments, receipts, expenses, history,
      canApprove: true, canEdit: purchase.status === 'draft',
    };
  }

  function productList() {
    return db.products.map((product) => {
      const variants = db.variants.filter((v) => v.productId === product.id).map((v) => ({
        id: v.id, productId: v.productId, size: v.size, color: v.color, styleName: v.styleName, extra: v.extra,
        retailPriceKop: v.retailPriceKop, qty: stockOf(v.id).qty, isActive: v.isActive,
        avgCostX10000: stockOf(v.id).avgCostX10000,
      }));
      return {
        id: product.id, sku: product.sku, name: product.name, categoryId: product.categoryId,
        categoryName: categoryName(product.categoryId), supplierName: supplierName(product.defaultSupplierId),
        season: product.season, brand: product.brand, unit: product.unit, photo: product.photo,
        isActive: product.isActive, updatedAt: product.updatedAt, variants,
        totalQty: variants.reduce((acc, v) => acc + v.qty, 0),
        prices: variants.map((v) => v.retailPriceKop),
      };
    });
  }

  function productDetail(product) {
    const base = productList().find((p) => p.id === product.id);
    const movements = db.movements
      .filter((m) => (variantById(m.variantId) || {}).productId === product.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id - a.id)
      .slice(0, 100)
      .map((m) => {
        const variant = variantById(m.variantId) || {};
        return {
          id: m.id, variantId: m.variantId, size: variant.size, color: variant.color, type: movementTypes[m.type] || m.type,
          qty: m.qty, unitCostX10000: m.unitCostX10000, valueKop: m.valueKop, docType: m.docType, docId: m.docId,
          comment: m.comment, createdAt: m.createdAt, authorName: userName(m.authorId),
        };
      });
    const priceHistory = db.priceHistory
      .filter((h) => (variantById(h.variantId) || {}).productId === product.id)
      .map((h) => ({
        id: h.id, variantId: h.variantId, oldPriceKop: h.oldPriceKop, newPriceKop: h.newPriceKop,
        changedAt: h.changedAt, changedByName: userName(h.changedBy), comment: h.comment,
      }));
    return {
      ...base, ageGroup: product.ageGroup, defaultSupplierId: product.defaultSupplierId,
      description: product.description, notes: product.notes, createdAt: product.createdAt,
      movements, priceHistory,
    };
  }

  function stockRows() {
    return db.variants.map((variant) => {
      const product = productById(variant.productId);
      const state = stockOf(variant.id);
      const row = {
        variantId: variant.id, productId: product.id, sku: product.sku, name: product.name,
        categoryName: categoryName(product.categoryId), size: variant.size, color: variant.color,
        styleName: variant.styleName, unit: product.unit, qty: state.qty,
        retailPriceKop: variant.retailPriceKop, isActive: product.isActive && variant.isActive,
      };
      if (can('cost.view')) {
        row.avgCostX10000 = state.avgCostX10000;
        row.valueKop = round((state.qty * state.avgCostX10000) / 10000);
      }
      return row;
    });
  }

  function saleItemsView(saleId) {
    return db.saleItems.filter((i) => i.saleId === Number(saleId)).map((item) => {
      const variant = variantById(item.variantId);
      const product = productById(variant.productId);
      const returned = db.returnItems.filter((ri) => ri.saleItemId === item.id).reduce((acc, ri) => acc + ri.qty, 0);
      return {
        id: item.id, variantId: item.variantId, sku: product.sku, name: product.name,
        size: variant.size, color: variant.color, qty: item.qty, priceKop: item.priceKop,
        returnedQty: returned, returnableQty: Math.max(item.qty - returned, 0),
        costUnitX10000: item.costUnitX10000, costTotalKop: item.costTotalKop,
      };
    });
  }

  function saleView(sale) {
    const items = saleItemsView(sale.id);
    const returns = db.returns.filter((r) => r.saleId === sale.id).map((r) => ({
      id: r.id, number: r.number, totalKop: r.totalKop, reason: r.reason, createdAt: r.createdAt,
      authorName: userName(r.authorId),
      items: db.returnItems.filter((ri) => ri.returnId === r.id).map((ri) => {
        const variant = variantById(ri.variantId);
        const product = productById(variant.productId);
        return {
          id: ri.id, saleItemId: ri.saleItemId, variantId: ri.variantId, sku: product.sku, name: product.name,
          size: variant.size, color: variant.color, qty: ri.qty, priceKop: ri.priceKop, condition: ri.condition,
        };
      }),
    }));
    return {
      id: sale.id, number: sale.number, soldAt: sale.soldAt, sellerId: sale.sellerId,
      sellerName: userName(sale.sellerId), subtotalKop: sale.subtotalKop, discountKop: sale.discountKop,
      totalKop: sale.totalKop,
      costTotalKop: can('cost.view') ? sale.costTotalKop : undefined,
      profitKop: can('reports.profit') ? sale.totalKop - sale.costTotalKop : undefined,
      comment: sale.comment, items, returns,
      returnedKop: returns.reduce((acc, r) => acc + r.totalKop, 0),
      canReturn: items.some((i) => i.returnableQty > 0),
    };
  }

  function salesList() {
    const canAll = can('sale.view_all');
    const user = currentUser() || { id: 0 };
    return db.sales
      .filter((sale) => canAll || sale.sellerId === user.id)
      .sort((a, b) => String(b.soldAt).localeCompare(String(a.soldAt)))
      .map((sale) => {
        const items = saleItemsView(sale.id);
        return {
          id: sale.id, number: sale.number, soldAt: sale.soldAt, sellerName: userName(sale.sellerId),
          qty: items.reduce((acc, i) => acc + i.qty, 0), totalKop: sale.totalKop,
          returnedKop: db.returns.filter((r) => r.saleId === sale.id).reduce((acc, r) => acc + r.totalKop, 0),
          costTotalKop: can('cost.view') ? sale.costTotalKop : undefined,
          profitKop: can('reports.profit') ? sale.totalKop - sale.costTotalKop : undefined,
          comment: sale.comment,
        };
      });
  }

  function receiptView(receipt) {
    const purchase = db.purchases.find((p) => p.id === receipt.purchaseId);
    const items = db.receiptItems.filter((ri) => ri.receiptId === receipt.id).map((ri) => {
      const poItem = db.purchaseItems.find((pi) => pi.id === ri.poItemId);
      const variant = variantById(poItem.variantId);
      const product = productById(variant.productId);
      const previously = db.receiptItems
        .filter((x) => x.poItemId === ri.poItemId && x.receiptId !== receipt.id && (db.receipts.find((r) => r.id === x.receiptId) || {}).status === 'posted')
        .reduce((acc, x) => acc + x.qtyReceived, 0);
      return {
        id: ri.id, poItemId: ri.poItemId, variantId: ri.variantId, sku: product.sku, productName: product.name,
        size: variant.size, color: variant.color, qtyOrdered: poItem.qty, previouslyReceived: previously,
        qtyReceived: ri.qtyReceived, qtyDamaged: ri.qtyDamaged,
        shortage: Math.max(poItem.qty - previously - ri.qtyReceived, 0), comment: null,
        unitCostX10000: ri.unitCostX10000, costTotalKop: ri.costTotalKop,
      };
    });
    const expenses = db.expenses.filter((e) => e.receiptId === receipt.id).map((e) => ({
      id: e.id, category: e.category, amountKop: e.amountKop, currency: e.currency, amountMinor: e.amountMinor,
      rateX10000: e.rateX10000, method: e.method, comment: e.comment, receiptId: e.receiptId,
      isCapitalized: e.isCapitalized, appliedAt: e.appliedAt, createdAt: e.createdAt, authorName: userName(e.authorId),
    }));
    return {
      id: receipt.id, number: receipt.number, purchaseId: receipt.purchaseId, purchaseNumber: purchase.number,
      purchaseStatus: purchase.status, supplierName: supplierName(purchase.supplierId),
      receiptDate: receipt.receiptDate, status: receipt.status,
      statusLabel: receipt.status === 'posted' ? 'Проведена' : 'Черновик',
      authorName: userName(receipt.authorId), postedAt: receipt.postedAt, comment: receipt.comment,
      items, expenses, allocations: [],
      totals: {
        qtyReceived: items.reduce((acc, i) => acc + i.qtyReceived, 0),
        costTotalKop: items.reduce((acc, i) => acc + (i.costTotalKop || 0), 0),
      },
      canEdit: receipt.status === 'draft',
    };
  }

  function receiptsList() {
    return db.receipts.slice().sort((a, b) => String(b.receiptDate).localeCompare(String(a.receiptDate))).map((receipt) => {
      const purchase = db.purchases.find((p) => p.id === receipt.purchaseId);
      return {
        id: receipt.id, number: receipt.number, purchaseId: receipt.purchaseId, purchaseNumber: purchase.number,
        supplierName: supplierName(purchase.supplierId), status: receipt.status,
        statusLabel: receipt.status === 'posted' ? 'Проведена' : 'Черновик',
        receiptDate: receipt.receiptDate, authorName: userName(receipt.authorId), postedAt: receipt.postedAt,
        lines: db.receiptItems.filter((ri) => ri.receiptId === receipt.id).length,
        qty: db.receiptItems.filter((ri) => ri.receiptId === receipt.id).reduce((acc, ri) => acc + ri.qtyReceived, 0),
      };
    });
  }

  function dashboard() {
    const stock = stockRows();
    const today = todayKey(now.toISOString());
    const month = monthKey(now.toISOString());
    const canAllSales = can('sale.view_all');
    const user = currentUser() || { id: 0 };
    const salesToday = db.sales.filter((s) => todayKey(s.soldAt) === today && (canAllSales || s.sellerId === user.id));
    const salesMonth = db.sales.filter((s) => monthKey(s.soldAt) === month && (canAllSales || s.sellerId === user.id));
    const returnsMonth = db.returns.filter((r) => monthKey(r.createdAt) === month);
    const threshold = Number(settings.low_stock_threshold);
    const low = stock.filter((s) => s.qty <= threshold);
    const inProgress = db.purchases.filter((p) => !['received', 'cancelled'].includes(p.status));
    return {
      models: db.products.filter((p) => p.isActive).length,
      variants: db.variants.length,
      stockValueKop: can('cost.view') ? stock.reduce((acc, s) => acc + (s.valueKop || 0), 0) : null,
      salesTodayKop: salesToday.reduce((acc, s) => acc + s.totalKop, 0),
      salesTodayCount: salesToday.length,
      monthRevenueKop: can('reports.profit') ? salesMonth.reduce((acc, s) => acc + s.totalKop, 0) : null,
      monthProfitKop: can('reports.profit')
        ? salesMonth.reduce((acc, s) => acc + (s.totalKop - s.costTotalKop), 0)
          - returnsMonth.reduce((acc, r) => acc + r.totalKop, 0)
        : null,
      lowStockCount: low.length,
      lowStock: low.slice(0, 20).map((s) => ({ variantId: s.variantId, sku: s.sku, name: s.name, size: s.size, color: s.color, qty: s.qty })),
      purchasesInProgress: can('purchase.view') ? inProgress.length : 0,
      expectedReceiptsQty: can('purchase.view') ? inProgress.reduce((acc, p) => acc + poTotals(p).inTransitQty, 0) : 0,
      lowStockThreshold: threshold,
    };
  }

  function stockReport() {
    const items = stockRows();
    return {
      items,
      totals: { variants: items.length, qty: items.reduce((acc, i) => acc + i.qty, 0), valueKop: items.reduce((acc, i) => acc + i.valueKop, 0) },
    };
  }

  function salesReport(params) {
    const rows = salesList().filter((s) => {
      if (params.from && s.soldAt < params.from) return false;
      if (params.to && s.soldAt > params.to) return false;
      return true;
    });
    const revenue = rows.reduce((acc, r) => acc + r.totalKop, 0);
    const cost = rows.reduce((acc, r) => acc + (r.costTotalKop || 0), 0);
    const returnsKop = rows.reduce((acc, r) => acc + r.returnedKop, 0);
    return {
      from: params.from || null, to: params.to || null,
      rows: rows.map((r) => ({
        id: r.id, number: r.number, soldAt: r.soldAt, sellerName: r.sellerName, qty: r.qty,
        totalKop: r.totalKop, costKop: r.costTotalKop, profitKop: r.profitKop,
        items: saleItemsView(r.id).map((i) => ({ sku: i.sku, name: i.name, size: i.size, color: i.color, qty: i.qty, priceKop: i.priceKop })),
      })),
      summary: {
        salesCount: rows.length, qty: rows.reduce((acc, r) => acc + r.qty, 0), revenueKop: revenue,
        costKop: cost, profitKop: revenue - returnsKop - cost, returnsCount: db.returns.length,
        returnsKop, returnsCostKop: 0, netRevenueKop: revenue - returnsKop,
      },
    };
  }

  function purchasesReport() {
    const rows = db.purchases.map(purchaseView);
    return {
      rows,
      summary: {
        count: rows.length,
        orderedQty: rows.reduce((acc, r) => acc + r.orderedQty, 0),
        receivedQty: rows.reduce((acc, r) => acc + r.receivedQty, 0),
        inTransitQty: rows.reduce((acc, r) => acc + r.inTransitQty, 0),
        cnyFen: rows.reduce((acc, r) => acc + r.cnyFen, 0),
        goodsKop: rows.reduce((acc, r) => acc + r.goodsKop, 0),
        expensesKop: rows.reduce((acc, r) => acc + r.expensesKop, 0),
      },
    };
  }

  function bootstrap() {
    return {
      user: currentUser(),
      settings: {
        companyName: settings.company_name, currency: settings.currency,
        lowStockThreshold: Number(settings.low_stock_threshold),
        maxSellerDiscountPercent: Number(settings.max_seller_discount_percent),
        purchaseNote: settings.purchase_note,
      },
      categories: can('catalog.view') ? categories : [],
      suppliers: can('suppliers.view') ? suppliers : [],
      roles, expenseCategories, allocationMethods,
      sellerDiscountLimit: Number(settings.max_seller_discount_percent),
    };
  }

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  }
  function fail(message, status = 400) {
    return json({ error: message }, status);
  }

  function readBody(init) {
    if (!init || !init.body) return {};
    try { return JSON.parse(init.body); } catch { return {}; }
  }

  function notFound() { return fail('Демо: раздел не найден', 404); }

  function handleAuth(method, path, body) {
    if (path === '/api/auth/me') {
      const user = currentUser();
      return user ? json({ user }) : fail('Требуется авторизация', 401);
    }
    if (path === '/api/auth/logout') {
      clearSession();
      return json({ ok: true });
    }
    if (path === '/api/auth/login') {
      const login = String((body && body.login) || '').trim().toLowerCase();
      const password = String((body && body.password) || '');
      const account = DEMO_ACCOUNTS[login];
      if (!account || account.password !== password) return fail('Неверный логин или пароль', 401);
      setSession(login);
      return json({ user: currentUser(), expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString() });
    }
    return null;
  }

  const GUARDS = [
    { methods: ['POST', 'PATCH', 'DELETE'], test: (p) => p.startsWith('/api/products') || p.startsWith('/api/variants') || p.startsWith('/api/categories'), perm: 'catalog.manage' },
    { methods: ['POST', 'PATCH'], test: (p) => p.startsWith('/api/suppliers'), perm: 'suppliers.manage' },
    { methods: ['POST'], test: (p) => p === '/api/purchases', perm: 'purchase.create' },
    { methods: ['PATCH'], test: (p) => /^\/api\/purchases\/\d+$/.test(p), perm: 'purchase.edit' },
    { methods: ['POST'], test: (p) => /^\/api\/purchases\/\d+\/status$/.test(p), perm: 'purchase.status' },
    { methods: ['POST'], test: (p) => /^\/api\/purchases\/\d+\/payments$/.test(p), perm: 'purchase.payments' },
    { methods: ['POST'], test: (p) => /^\/api\/purchases\/\d+\/expenses$/.test(p), perm: 'expenses.manage' },
    { methods: ['POST'], test: (p) => /^\/api\/purchases\/\d+\/receipts$/.test(p), perm: 'receipt.create' },
    { methods: ['PATCH', 'DELETE'], test: (p) => /^\/api\/receipts\/\d+$/.test(p), perm: 'receipt.create' },
    { methods: ['POST'], test: (p) => /^\/api\/receipts\/\d+\/post$/.test(p), perm: 'receipt.post' },
    { methods: ['POST'], test: (p) => p === '/api/stock/adjustments' || p === '/api/stock/writeoffs', perm: 'stock.adjust' },
    { methods: ['POST'], test: (p) => p === '/api/inventory' || /^\/api\/inventory\/\d+\/post$/.test(p), perm: 'stock.inventory' },
    { methods: ['POST'], test: (p) => p === '/api/sales', perm: 'sale.create' },
    { methods: ['POST'], test: (p) => p === '/api/returns', perm: 'return.create' },
    { methods: ['GET', 'POST', 'PATCH'], test: (p) => p.startsWith('/api/users'), perm: 'users.manage' },
    { methods: ['GET'], test: (p) => p === '/api/audit', perm: 'audit.view' },
    { methods: ['GET', 'PATCH'], test: (p) => p === '/api/settings', perm: 'settings.manage' },
    { methods: ['GET'], test: (p) => p === '/api/system', perm: 'settings.manage' },
    { methods: ['GET'], test: (p) => p === '/api/reports/purchases' || p.startsWith('/api/reports/purchase/'), perm: 'reports.purchases' },
    { methods: ['GET'], test: (p) => p === '/api/reports/sales', perm: 'sale.create' },
    { methods: ['GET'], test: (p) => p === '/api/reports/stock', perm: 'stock.view' },
    { methods: ['GET'], test: (p) => p === '/api/purchases' || /^\/api\/purchases\/\d+$/.test(p), perm: 'purchase.view' },
    { methods: ['GET'], test: (p) => p === '/api/receipts' || /^\/api\/receipts\/\d+$/.test(p), perm: 'receipt.view' },
    { methods: ['GET'], test: (p) => p === '/api/stock' || p === '/api/stock/movements', perm: 'stock.view' },
    { methods: ['GET'], test: (p) => p === '/api/returns' || /^\/api\/returns\/\d+$/.test(p), perm: 'return.create' },
    { methods: ['GET'], test: (p) => p === '/api/sales' || /^\/api\/sales\/\d+$/.test(p), perm: 'sale.create' },
    { methods: ['GET'], test: (p) => p === '/api/products' || /^\/api\/products\/\d+$/.test(p), perm: 'catalog.view' },
    { methods: ['GET'], test: (p) => p === '/api/categories', perm: 'catalog.view' },
    { methods: ['GET'], test: (p) => p === '/api/suppliers', perm: 'suppliers.view' },
  ];

  function guard(method, path) {
    for (const rule of GUARDS) {
      if (!rule.methods.includes(method)) continue;
      if (!rule.test(path)) continue;
      if (!can(rule.perm)) return true;
    }
    return false;
  }

  async function handle(url, init) {
    const method = (init && init.method ? init.method : 'GET').toUpperCase();
    const path = url.pathname;
    const params = Object.fromEntries(url.searchParams.entries());
    const parts = path.split('/').filter(Boolean);
    const body = readBody(init);

    const authResult = handleAuth(method, path, body);
    if (authResult) return authResult;

    if (path === '/api/health') return json({ ok: true, demo: true, time: new Date().toISOString() });
    if (!currentUser()) return fail('Требуется авторизация', 401);
    if (guard(method, path)) return json({ error: 'Недостаточно прав для этой операции' }, 403);
    if (path === '/api/bootstrap') return json(bootstrap());
    if (path === '/api/dashboard') return json(dashboard());

    if (path === '/api/categories') {
      if (method === 'POST') {
        const id = Math.max(...categories.map((c) => c.id)) + 1;
        categories.push({ id, name: body.name, sort: 100, isActive: true });
        return json({ id, name: body.name });
      }
      return json(categories);
    }
    if (/^\/api\/categories\/\d+$/.test(path) && method === 'PATCH') {
      const category = categories.find((c) => c.id === Number(parts[2]));
      if (!category) return fail('Категория не найдена', 404);
      Object.assign(category, { name: body.name || category.name, isActive: body.isActive !== false });
      return json(category);
    }

    if (path === '/api/suppliers') {
      if (method === 'POST') {
        const id = Math.max(...suppliers.map((s) => s.id)) + 1;
        suppliers.push({ id, name: body.name, code: body.code, country: body.country, contact: body.contact, notes: body.notes, isActive: true, createdAt: new Date().toISOString() });
        return json({ id, name: body.name });
      }
      return json(suppliers.map((s) => ({ ...s, purchasesCount: db.purchases.filter((p) => p.supplierId === s.id).length })));
    }
    if (/^\/api\/suppliers\/\d+$/.test(path) && method === 'PATCH') {
      const supplier = suppliers.find((s) => s.id === Number(parts[2]));
      if (!supplier) return fail('Поставщик не найден', 404);
      Object.assign(supplier, body);
      return json(supplier);
    }

    if (path === '/api/products' && method === 'GET') {
      let rows = productList();
      const search = (params.search || '').toLowerCase();
      if (search) rows = rows.filter((p) => `${p.sku} ${p.name} ${p.brand || ''}`.toLowerCase().includes(search));
      if (params.categoryId) rows = rows.filter((p) => p.categoryId === Number(params.categoryId));
      if (params.inStock === '1') rows = rows.filter((p) => p.totalQty > 0);
      if (params.includeArchived !== '1') rows = rows.filter((p) => p.isActive);
      if (params.sort === 'stock') rows = rows.slice().sort((a, b) => b.totalQty - a.totalQty);
      else if (params.sort === 'price') rows = rows.slice().sort((a, b) => Math.min(...a.prices, Infinity) - Math.min(...b.prices, Infinity));
      else if (params.sort === 'updated') rows = rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      else rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      return json(rows);
    }

    if (path === '/api/products' && method === 'POST') {
      const productId = nextId();
      db.products.push({
        id: productId, sku: String(body.sku || '').toUpperCase(), name: body.name, categoryId: Number(body.categoryId) || null,
        unit: body.unit || 'шт', season: body.season || null, ageGroup: body.ageGroup || null, brand: body.brand || null,
        defaultSupplierId: Number(body.defaultSupplierId) || null, description: body.description || null,
        notes: body.notes || null, photo: null, isActive: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      (body.variants || [{}]).forEach((variant) => {
        variantSeq += 1;
        db.variants.push({
          id: variantSeq, productId, size: variant.size || '', color: variant.color || '',
          styleName: variant.styleName || '', extra: variant.extra || '',
          retailPriceKop: round(Number(String(variant.retail_price || '0').replace(',', '.')) * 100), isActive: true,
        });
        db.stock.set(variantSeq, { qty: 0, avgCostX10000: 0 });
      });
      return json(productDetail(productById(productId)));
    }

    if (/^\/api\/products\/\d+$/.test(path)) {
      const product = productById(parts[2]);
      if (!product) return fail('Товар не найден', 404);
      if (method === 'PATCH') {
        Object.assign(product, body, { updatedAt: new Date().toISOString() });
        return json(productDetail(product));
      }
      return json(productDetail(product));
    }

    if (/^\/api\/products\/\d+\/variants$/.test(path) && method === 'POST') {
      const product = productById(parts[2]);
      if (!product) return fail('Товар не найден', 404);
      variantSeq += 1;
      const variant = {
        id: variantSeq, productId: product.id, size: body.size || '', color: body.color || '',
        styleName: body.styleName || '', extra: body.extra || '',
        retailPriceKop: round(Number(String(body.retail_price || '0').replace(',', '.')) * 100), isActive: true,
      };
      db.variants.push(variant);
      db.stock.set(variant.id, { qty: 0, avgCostX10000: 0 });
      return json(variant);
    }

    if (/^\/api\/products\/\d+\/photo$/.test(path) && method === 'POST') {
      const product = productById(parts[2]);
      if (!product) return fail('Товар не найден', 404);
      product.photo = body.dataUrl || product.photo;
      return json({ photo: product.photo });
    }

    if (/^\/api\/variants\/\d+$/.test(path) && method === 'PATCH') {
      const variant = variantById(parts[2]);
      if (!variant) return fail('Вариант не найден', 404);
      if (body.retail_price !== undefined && body.retail_price !== '') {
        const next = round(Number(String(body.retail_price).replace(',', '.')) * 100);
        if (next !== variant.retailPriceKop) {
          db.priceHistory.push({
            id: nextId(), variantId: variant.id, oldPriceKop: variant.retailPriceKop, newPriceKop: next,
            changedAt: new Date().toISOString(), changedBy: 1, comment: null,
          });
          variant.retailPriceKop = next;
        }
      }
      if (body.size !== undefined) variant.size = body.size;
      if (body.color !== undefined) variant.color = body.color;
      if (body.styleName !== undefined) variant.styleName = body.styleName;
      if (body.extra !== undefined) variant.extra = body.extra;
      if (body.isActive !== undefined) variant.isActive = !!body.isActive;
      return json({ ...variant, qty: stockOf(variant.id).qty, avgCostX10000: stockOf(variant.id).avgCostX10000 });
    }

    if (path === '/api/purchases' && method === 'GET') {
      let rows = db.purchases.map(purchaseView);
      if (params.status) rows = rows.filter((r) => r.status === params.status);
      if (params.search) {
        const search = params.search.toLowerCase();
        rows = rows.filter((r) => `${r.number} ${r.supplierName}`.toLowerCase().includes(search));
      }
      return json(rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    }

    if (path === '/api/purchases' && method === 'POST') {
      const purchaseId = nextId();
      const number = `PO-${String(db.purchases.length + 1).padStart(5, '0')}`;
      db.purchases.push({
        id: purchaseId, number, supplierId: Number(body.supplierId), currency: 'CNY',
        rateX10000: round(Number(String(body.rate || '0').replace(',', '.')) * 10000),
        rateDate: body.rateDate || new Date().toISOString(), rateSource: body.rateSource || null,
        status: 'draft', authorId: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        approvedAt: null, approvedBy: null, cancelledAt: null, cancelReason: null, comment: body.comment || null,
      });
      (body.items || []).forEach((item, index) => {
        db.purchaseItems.push({
          id: nextId(), purchaseId, variantId: Number(item.variantId), qty: Number(item.qty),
          priceCnyFen: round(Number(String(item.priceCny || '0').replace(',', '.')) * 100), lineNo: index + 1,
        });
      });
      return json(purchaseDetail(db.purchases.find((p) => p.id === purchaseId)));
    }

    if (/^\/api\/purchases\/\d+$/.test(path)) {
      const purchase = db.purchases.find((p) => p.id === Number(parts[2]));
      if (!purchase) return fail('Закупка не найдена', 404);
      if (method === 'PATCH') {
        if (body.supplierId) purchase.supplierId = Number(body.supplierId);
        if (body.rate) purchase.rateX10000 = round(Number(String(body.rate).replace(',', '.')) * 10000);
        if (body.comment !== undefined) purchase.comment = body.comment;
        purchase.updatedAt = new Date().toISOString();
        return json(purchaseDetail(purchase));
      }
      return json(purchaseDetail(purchase));
    }

    if (/^\/api\/purchases\/\d+\/status$/.test(path) && method === 'POST') {
      const purchase = db.purchases.find((p) => p.id === Number(parts[2]));
      if (!purchase) return fail('Закупка не найдена', 404);
      purchase.status = body.status;
      purchase.updatedAt = new Date().toISOString();
      addAudit('purchase.status', 'purchase', purchase.id, { from: purchase.status, to: body.status, comment: body.comment || null }, purchase.updatedAt, 1);
      return json(purchaseDetail(purchase));
    }

    if (/^\/api\/purchases\/\d+\/payments$/.test(path) && method === 'POST') {
      const purchase = db.purchases.find((p) => p.id === Number(parts[2]));
      if (!purchase) return fail('Закупка не найдена', 404);
      const amountKop = round(Number(String(body.amount || '0').replace(',', '.')) * 100);
      db.payments.push({
        id: nextId(), purchaseId: purchase.id, currency: body.currency || 'RUB',
        amountMinor: amountKop, rateX10000: 10000, amountKop,
        paidAt: body.paidAt || new Date().toISOString(), comment: body.comment || null, authorId: 1,
      });
      return json(purchaseDetail(purchase));
    }

    if (/^\/api\/purchases\/\d+\/expenses$/.test(path) && method === 'POST') {
      const purchase = db.purchases.find((p) => p.id === Number(parts[2]));
      if (!purchase) return fail('Закупка не найдена', 404);
      const amountKop = round(Number(String(body.amount || '0').replace(',', '.')) * 100);
      db.expenses.push({
        id: nextId(), purchaseId: purchase.id, receiptId: body.receiptId ? Number(body.receiptId) : null,
        category: body.category || 'other', amountKop, currency: body.currency || 'RUB', amountMinor: amountKop,
        rateX10000: 10000, method: body.method || 'value', comment: body.comment || null,
        isCapitalized: body.isCapitalized !== false, appliedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(), authorId: 1,
      });
      return json({ id: nextId(), applied: true, allocated: [] });
    }

    if (/^\/api\/purchases\/\d+\/receipts$/.test(path) && method === 'POST') {
      const purchase = db.purchases.find((p) => p.id === Number(parts[2]));
      if (!purchase) return fail('Закупка не найдена', 404);
      const receiptId = nextId();
      const number = `RCP-${String(db.receipts.length + 1).padStart(5, '0')}`;
      db.receipts.push({
        id: receiptId, number, purchaseId: purchase.id,
        receiptDate: body.receiptDate || new Date().toISOString(), status: 'draft',
        authorId: 1, postedAt: null, comment: body.comment || null,
      });
      db.purchaseItems.filter((i) => i.purchaseId === purchase.id).forEach((item) => {
        const received = db.receiptItems
          .filter((ri) => ri.poItemId === item.id && (db.receipts.find((r) => r.id === ri.receiptId) || {}).status === 'posted')
          .reduce((acc, ri) => acc + ri.qtyReceived, 0);
        db.receiptItems.push({
          id: nextId(), receiptId, poItemId: item.id,
          qtyReceived: Math.max(item.qty - received, 0), qtyDamaged: 0,
          unitCostX10000: 0, costTotalKop: 0,
        });
      });
      return json(receiptView(db.receipts.find((r) => r.id === receiptId)));
    }

    if (path === '/api/receipts') return json(receiptsList());

    if (/^\/api\/receipts\/\d+$/.test(path)) {
      const receipt = db.receipts.find((r) => r.id === Number(parts[2]));
      if (!receipt) return fail('Приёмка не найдена', 404);
      if (method === 'PATCH') {
        if (receipt.status === 'draft' && Array.isArray(body.items)) {
          body.items.forEach((line) => {
            const row = db.receiptItems.find((ri) => ri.id === Number(line.id));
            if (row) {
              row.qtyReceived = Number(line.qtyReceived) || 0;
              row.qtyDamaged = Number(line.qtyDamaged) || 0;
            }
          });
        }
        return json(receiptView(receipt));
      }
      if (method === 'DELETE') {
        db.receiptItems = db.receiptItems.filter((ri) => ri.receiptId !== receipt.id);
        db.receipts = db.receipts.filter((r) => r.id !== receipt.id);
        return json({ deleted: true });
      }
      return json(receiptView(receipt));
    }

    if (/^\/api\/receipts\/\d+\/post$/.test(path) && method === 'POST') {
      const receipt = db.receipts.find((r) => r.id === Number(parts[2]));
      if (!receipt) return fail('Приёмка не найдена', 404);
      if (receipt.status === 'posted') return fail('Приёмка уже проведена', 409);
      const purchase = db.purchases.find((p) => p.id === receipt.purchaseId);
      db.receiptItems.filter((ri) => ri.receiptId === receipt.id).forEach((ri) => {
        const poItem = db.purchaseItems.find((pi) => pi.id === ri.poItemId);
        if (!poItem || ri.qtyReceived <= 0) return;
        const goods = round((poItem.priceCnyFen * ri.qtyReceived * purchase.rateX10000) / 10000);
        const unit = round((goods * 10000) / ri.qtyReceived);
        ri.unitCostX10000 = unit;
        ri.costTotalKop = goods;
        addMovement({
          variantId: poItem.variantId, type: 'receipt', qty: ri.qtyReceived, unitCostX10000: unit,
          valueKop: goods, docType: 'receipt', docId: receipt.id,
          comment: `Приёмка ${receipt.number}`, at: receipt.receiptDate, authorId: 1,
        });
      });
      receipt.status = 'posted';
      receipt.postedAt = new Date().toISOString();
      const fully = db.purchaseItems.filter((pi) => pi.purchaseId === purchase.id).every((pi) => {
        const received = db.receiptItems
          .filter((ri) => ri.poItemId === pi.id && (db.receipts.find((r) => r.id === ri.receiptId) || {}).status === 'posted')
          .reduce((acc, ri) => acc + ri.qtyReceived, 0);
        return received >= pi.qty;
      });
      purchase.status = fully ? 'received' : 'partially_received';
      return json(receiptView(receipt));
    }

    if (path === '/api/stock') {
      let rows = stockRows();
      if (params.search) {
        const search = params.search.toLowerCase();
        rows = rows.filter((r) => `${r.sku} ${r.name} ${r.size} ${r.color}`.toLowerCase().includes(search));
      }
      if (params.low === '1') rows = rows.filter((r) => r.qty <= Number(settings.low_stock_threshold));
      return json(rows);
    }

    if (path === '/api/stock/movements') {
      let rows = db.movements.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id - a.id);
      if (params.type) rows = rows.filter((m) => m.type === params.type);
      return json(rows.map((m) => {
        const variant = variantById(m.variantId) || {};
        const product = productById(variant.productId) || {};
        return {
          id: m.id, variantId: m.variantId, sku: product.sku, name: product.name,
          size: variant.size, color: variant.color, type: m.type, typeLabel: movementTypes[m.type] || m.type,
          qty: m.qty, docType: m.docType, docId: m.docId, comment: m.comment, createdAt: m.createdAt,
          authorName: userName(m.authorId), unitCostX10000: m.unitCostX10000, valueKop: m.valueKop,
        };
      }));
    }

    if (path === '/api/stock/adjustments' && method === 'POST') {
      const state = stockOf(body.variantId);
      const target = Number(body.qty);
      const delta = Number.isFinite(target) ? target - state.qty : Number(body.qtyDelta);
      if (!delta) return json({ qty: state.qty, message: 'Остаток не изменился' });
      addMovement({
        variantId: Number(body.variantId), type: delta < 0 ? 'writeoff' : 'adjustment', qty: delta,
        docType: 'adjustment', docId: null, comment: body.reason, at: new Date().toISOString(), authorId: 1,
      });
      return json({ qty: stockOf(body.variantId).qty, avgCostX10000: stockOf(body.variantId).avgCostX10000 });
    }

    if (path === '/api/stock/writeoffs' && method === 'POST') {
      addMovement({
        variantId: Number(body.variantId), type: 'writeoff', qty: -Math.abs(Number(body.qty)),
        docType: 'adjustment', docId: null, comment: body.reason, at: new Date().toISOString(), authorId: 1,
      });
      return json({ qty: stockOf(body.variantId).qty });
    }

    if (path === '/api/inventory') {
      if (method === 'POST') {
        const countId = nextId();
        db.inventory.push({
          id: countId, number: `INV-${String(db.inventory.length + 1).padStart(5, '0')}`,
          countedAt: new Date().toISOString(), status: 'draft', authorId: 1, postedAt: null, comment: body.comment || null,
        });
        (body.items || []).forEach((item) => {
          db.inventoryItems.push({
            id: nextId(), countId, variantId: Number(item.variantId),
            qtyExpected: stockOf(item.variantId).qty, qtyActual: Number(item.qtyActual), comment: null,
          });
        });
        return json(inventoryDetail(countId));
      }
      return json(db.inventory.slice().reverse().map((doc) => ({
        id: doc.id, number: doc.number, countedAt: doc.countedAt, status: doc.status,
        statusLabel: doc.status === 'posted' ? 'Проведена' : 'Черновик', authorName: userName(doc.authorId),
        itemsCount: db.inventoryItems.filter((i) => i.countId === doc.id).length,
        diffCount: db.inventoryItems.filter((i) => i.countId === doc.id && i.qtyActual !== i.qtyExpected).length,
        comment: doc.comment,
      })));
    }

    if (/^\/api\/inventory\/\d+$/.test(path)) {
      const doc = db.inventory.find((d) => d.id === Number(parts[2]));
      if (!doc) return fail('Инвентаризация не найдена', 404);
      return json(inventoryDetail(doc.id));
    }

    if (/^\/api\/inventory\/\d+\/post$/.test(path) && method === 'POST') {
      const doc = db.inventory.find((d) => d.id === Number(parts[2]));
      if (!doc) return fail('Инвентаризация не найдена', 404);
      db.inventoryItems.filter((i) => i.countId === doc.id).forEach((item) => {
        const delta = item.qtyActual - stockOf(item.variantId).qty;
        if (!delta) return;
        addMovement({
          variantId: item.variantId, type: 'inventory', qty: delta, docType: 'inventory', docId: doc.id,
          comment: `Инвентаризация ${doc.number}`, at: new Date().toISOString(), authorId: 1,
        });
      });
      doc.status = 'posted';
      doc.postedAt = new Date().toISOString();
      return json(inventoryDetail(doc.id));
    }

    if (path === '/api/sales' && method === 'GET') return json(salesList());

    if (path === '/api/sales' && method === 'POST') {
      const items = body.items || [];
      if (!items.length) return fail('Корзина пуста');
      for (const item of items) {
        const state = stockOf(item.variantId);
        if (state.qty < Number(item.qty)) {
          const variant = variantById(item.variantId);
          const product = productById(variant.productId);
          return fail(`«${product.name}»: доступно ${state.qty}, запрошено ${item.qty}`, 409);
        }
      }
      const saleId = createSaleFixture({
        at: new Date().toISOString(), sellerId: 1,
        items: items.map((i) => ({ variantId: Number(i.variantId), qty: Number(i.qty), priceKop: Number(i.priceKop) || undefined })),
        discountKop: Number(body.discountKop) || 0,
      });
      return json(saleView(db.sales.find((s) => s.id === saleId)));
    }

    if (/^\/api\/sales\/\d+$/.test(path)) {
      const sale = db.sales.find((s) => s.id === Number(parts[2]));
      if (!sale) return fail('Продажа не найдена', 404);
      if (!can('sale.view_all') && sale.sellerId !== (currentUser() || {}).id) {
        return json({ error: 'Доступна только собственная продажа' }, 403);
      }
      return json(saleView(sale));
    }

    if (path === '/api/returns') {
      if (method === 'POST') {
        const sale = db.sales.find((s) => s.id === Number(body.saleId));
        if (!sale) return fail('Продажа не найдена', 404);
        const returnId = nextId();
        returnSeq += 1;
        let total = 0;
        const lines = (body.items || []).map((item) => {
          const saleItem = db.saleItems.find((si) => si.id === Number(item.saleItemId));
          const variant = variantById(saleItem.variantId);
          total += saleItem.priceKop * Number(item.qty);
          return { saleItem, variant, qty: Number(item.qty), condition: item.condition || 'sellable' };
        });
        db.returns.push({
          id: returnId, number: `RET-${String(returnSeq).padStart(5, '0')}`, saleId: sale.id,
          reason: body.reason, totalKop: total, status: 'posted', createdAt: new Date().toISOString(), authorId: 1,
        });
        lines.forEach((line) => {
          db.returnItems.push({
            id: nextId(), returnId, saleItemId: line.saleItem.id, variantId: line.saleItem.variantId,
            qty: line.qty, priceKop: line.saleItem.priceKop, condition: line.condition,
            costUnitX10000: line.saleItem.costUnitX10000,
          });
          if (line.condition === 'sellable') {
            addMovement({
              variantId: line.saleItem.variantId, type: 'sale_return', qty: line.qty,
              unitCostX10000: line.saleItem.costUnitX10000, docType: 'return', docId: returnId,
              comment: `Возврат RET-${String(returnSeq).padStart(5, '0')}`, at: new Date().toISOString(), authorId: 1,
            });
          }
        });
        return json(returnView(returnId));
      }
      return json(returnsList());
    }

    if (/^\/api\/returns\/\d+$/.test(path)) {
      const returnId = Number(parts[2]);
      const doc = db.returns.find((r) => r.id === returnId);
      if (!doc) return fail('Возврат не найден', 404);
      if (!can('sale.view_all') && doc.authorId !== (currentUser() || {}).id) {
        return json({ error: 'Возврат доступен только автору или владельцу' }, 403);
      }
      return json(returnView(returnId));
    }

    if (path === '/api/reports/stock') {
      const report = stockReport();
      if (params.search) {
        const search = params.search.toLowerCase();
        report.items = report.items.filter((i) => `${i.sku} ${i.name}`.toLowerCase().includes(search));
        report.totals = {
          variants: report.items.length,
          qty: report.items.reduce((acc, i) => acc + i.qty, 0),
          valueKop: report.items.reduce((acc, i) => acc + i.valueKop, 0),
        };
      }
      return json(report);
    }
    if (path === '/api/reports/sales') return json(salesReport(params));
    if (path === '/api/reports/purchases') return json(purchasesReport());
    if (/^\/api\/reports\/purchase\/\d+$/.test(path)) {
      const purchase = db.purchases.find((p) => p.id === Number(parts[3]));
      if (!purchase) return fail('Закупка не найдена', 404);
      return json({ purchase, items: poItems(purchase.id), totals: poTotals(purchase) });
    }

    if (path === '/api/users') {
      if (method === 'POST') {
        const id = Math.max(...users.map((u) => u.id)) + 1;
        users.push({ id, login: body.login, fullName: body.fullName, role: body.role, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, sessionsCount: 0 });
        return json({ id, login: body.login, fullName: body.fullName, role: body.role });
      }
      return json(users.map((u) => ({ ...u, roleLabel: roles[u.role] || u.role })));
    }
    if (/^\/api\/users\/\d+$/.test(path) && method === 'PATCH') {
      const user = users.find((u) => u.id === Number(parts[2]));
      if (!user) return fail('Пользователь не найден', 404);
      if (body.fullName) user.fullName = body.fullName;
      if (body.role) user.role = body.role;
      if (body.isActive !== undefined) user.isActive = !!body.isActive;
      return json({ ...user, roleLabel: roles[user.role] });
    }
    if (path === '/api/users/me/password' && method === 'POST') return json({ changed: true });

    if (path === '/api/audit') {
      let rows = db.audit.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
      if (params.action) rows = rows.filter((a) => a.action.includes(params.action));
      return json(rows.slice(0, Number(params.limit) || 200));
    }

    if (path === '/api/settings') {
      if (method === 'PATCH') {
        if (body.company_name !== undefined) settings.company_name = body.company_name;
        if (body.low_stock_threshold !== undefined) settings.low_stock_threshold = Number(body.low_stock_threshold);
        if (body.max_seller_discount_percent !== undefined) settings.max_seller_discount_percent = Number(body.max_seller_discount_percent);
        if (body.purchase_note !== undefined) settings.purchase_note = body.purchase_note;
      }
      return json({ ...settings });
    }

    if (path === '/api/system') {
      return json({
        counts: {
          products: db.products.length, variants: db.variants.length, purchases: db.purchases.length,
          receipts: db.receipts.length, sales: db.sales.length, returns: db.returns.length,
          movements: db.movements.length,
        },
        currency: 'RUB', version: '1.0.0-demo', port: 0, addresses: [],
        backupHint: 'Демо-режим: данные хранятся только в приложении.',
      });
    }

    if (path.startsWith('/api/export/')) {
      return new Response('Раздел', { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
    }

    return notFound();
  }

  function returnsList() {
    const canAll = can('sale.view_all');
    const user = currentUser() || { id: 0 };
    return db.returns
      .filter((doc) => canAll || doc.authorId === user.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((doc) => {
      const sale = db.sales.find((s) => s.id === doc.saleId);
      const items = db.returnItems.filter((ri) => ri.returnId === doc.id);
      return {
        id: doc.id, number: doc.number, saleId: doc.saleId, saleNumber: sale.number, reason: doc.reason,
        totalKop: doc.totalKop, qty: items.reduce((acc, i) => acc + i.qty, 0),
        hasDamaged: items.some((i) => i.condition === 'damaged'),
        createdAt: doc.createdAt, authorName: userName(doc.authorId),
      };
    });
  }

  function returnView(returnId) {
    const doc = db.returns.find((r) => r.id === Number(returnId));
    const sale = db.sales.find((s) => s.id === doc.saleId);
    return {
      id: doc.id, number: doc.number, saleId: doc.saleId, saleNumber: sale.number, reason: doc.reason,
      totalKop: doc.totalKop, createdAt: doc.createdAt, authorName: userName(doc.authorId),
      items: db.returnItems.filter((ri) => ri.returnId === doc.id).map((ri) => {
        const variant = variantById(ri.variantId);
        const product = productById(variant.productId);
        return {
          id: ri.id, saleItemId: ri.saleItemId, variantId: ri.variantId, sku: product.sku, name: product.name,
          size: variant.size, color: variant.color, qty: ri.qty, priceKop: ri.priceKop, condition: ri.condition,
        };
      }),
    };
  }

  function inventoryDetail(countId) {
    const doc = db.inventory.find((d) => d.id === Number(countId));
    return {
      id: doc.id, number: doc.number, countedAt: doc.countedAt, status: doc.status,
      authorName: userName(doc.authorId), comment: doc.comment, postedAt: doc.postedAt,
      items: db.inventoryItems.filter((i) => i.countId === doc.id).map((item) => {
        const variant = variantById(item.variantId);
        const product = productById(variant.productId);
        return {
          id: item.id, variantId: item.variantId, sku: product.sku, name: product.name,
          size: variant.size, color: variant.color, qtyExpected: item.qtyExpected, qtyActual: item.qtyActual,
          diff: item.qtyActual - item.qtyExpected, comment: item.comment,
        };
      }),
    };
  }

  window.fetch = function demoFetch(input, init) {
    const raw = typeof input === 'string' ? input : (input && input.url) || '';
    let url;
    try { url = new URL(raw, location.href); } catch { return realFetch(input, init); }
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = (init && init.method ? init.method : 'GET').toUpperCase();
    return handle(url, { ...(init || {}), method }).catch((err) => fail(err.message || 'Ошибка демо-режима', 500));
  };

  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.createElement('div');
    badge.textContent = 'Демо';
    badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:150;background:#4f46e5;color:#fff;font:600 12px/1 "Segoe UI",sans-serif;padding:8px 12px;border-radius:999px;box-shadow:0 6px 18px rgba(16,24,40,.25);';
    document.body.appendChild(badge);
  });
})();
