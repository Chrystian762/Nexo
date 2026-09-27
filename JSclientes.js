// Base de dados simulada baseada na imagem
let clientsData = [
    {
        id: 1,
        name: "Durval de Oliveira",
        email: "durval.oliveira@email.com",
        type: "Pessoa Física",
        contact: "(11) 98765-4321",
        city: "São Paulo - SP",
        lastPurchase: "07/05/2024",
        status: "Ativo",
        avatarType: "img",
        avatarSrc: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
    },
    {
        id: 2,
        name: "Emaminondas Costa",
        email: "emacosta@email.com",
        type: "Pessoa Física",
        contact: "(11) 91234-5678",
        city: "Guarulhos - SP",
        lastPurchase: "03/05/2024",
        status: "Ativo",
        avatarType: "img",
        avatarSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces"
    },
    {
        id: 3,
        name: "Leticia Pires",
        email: "leticia.pires@email.com",
        type: "Pessoa Física",
        contact: "(11) 99876-1234",
        city: "Osasco - SP",
        lastPurchase: "01/05/2024",
        status: "Ativo",
        avatarType: "img",
        avatarSrc: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces"
    },
    {
        id: 4,
        name: "Cleidiane Cardoso",
        email: "cleidiane.cardoso@email.com",
        type: "Pessoa Física",
        contact: "(11) 96666-8888",
        city: "São Bernardo do Campo - SP",
        lastPurchase: "29/04/2024",
        status: "Ativo",
        avatarType: "img",
        avatarSrc: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces"
    },
    {
        id: 5,
        name: "Maria Rodrigues",
        email: "maria.rodrigues@email.com",
        type: "Pessoa Jurídica",
        contact: "(11) 93456-7890",
        city: "Santo André - SP",
        lastPurchase: "27/04/2024",
        status: "Ativo",
        avatarType: "initials",
        initials: "MR"
    },
    {
        id: 6,
        name: "Beleza & Cia Ltda",
        email: "contato@belezacia.com.br",
        type: "Pessoa Jurídica",
        contact: "(11) 95555-3333",
        city: "Campinas - SP",
        lastPurchase: "25/04/2024",
        status: "Inativo",
        avatarType: "initials",
        initials: "BC"
    },
    {
        id: 7,
        name: "Juliana Mendes",
        email: "juliana.mendes@email.com",
        type: "Pessoa Física",
        contact: "(11) 97777-2222",
        city: "São Paulo - SP",
        lastPurchase: "22/04/2024",
        status: "Ativo",
        avatarType: "img",
        avatarSrc: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces"
    },
    {
        id: 8,
        name: "Studio Beleza",
        email: "atendimento@studiobeleza.com.br",
        type: "Pessoa Jurídica",
        contact: "(11) 98888-1111",
        city: "Mauá - SP",
        lastPurchase: "20/04/2024",
        status: "Ativo",
        avatarType: "initials",
        initials: "SB"
    }
];

// Configurações de Paginação
let currentPage = 1;
const rowsPerPage = 5; // Quantidade de clientes por página (pode alterar para 8 se preferir)

// Elementos do DOM
const tableBody = document.getElementById('clientsTableBody');
const searchInput = document.getElementById('searchCliente');
const filterStatus = document.getElementById('filterStatus');
const filterCidade = document.getElementById('filterCidade');
const filterTipo = document.getElementById('filterTipo');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const paginationInfo = document.getElementById('paginationInfo');
const paginationControls = document.querySelector('.pagination-controls');
const btnCadastrar = document.getElementById('btnCadastrar');

// Contadores de métricas
const totalClientesCount = document.getElementById('totalClientesCount');
const clientesAtivosCount = document.getElementById('clientesAtivosCount');
const clientesInativosCount = document.getElementById('clientesInativosCount');

const clientModal = document.getElementById('clientModal');
const modalTitle = document.getElementById('modalTitle');
const modalBodyContent = document.getElementById('modalBodyContent');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalCloseAction = document.getElementById('modalCloseAction');

// Atualizar métricas
function updateMetrics() {
    const total = clientsData.length;
    const ativos = clientsData.filter(c => c.status === 'Ativo').length;
    const inativos = clientsData.filter(c => c.status === 'Inativo').length;

    if (totalClientesCount) totalClientesCount.textContent = total;
    if (clientesAtivosCount) clientesAtivosCount.textContent = ativos;
    if (clientesInativosCount) clientesInativosCount.textContent = inativos;
}

// Obter dados filtrados atuais
function getFilteredData() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusVal = filterStatus.value;
    const cidadeVal = filterCidade.value;
    const tipoVal = filterTipo.value;

    return clientsData.filter(client => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm) || 
                              client.email.toLowerCase().includes(searchTerm) || 
                              client.contact.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusVal === "" || client.status === statusVal;
        const matchesCidade = cidadeVal === "" || client.city === cidadeVal;
        const matchesTipo = tipoVal === "" || client.type === tipoVal;

        return matchesSearch && matchesStatus && matchesCidade && matchesTipo;
    });
}

// Renderizar Tabela e Paginação
function renderTable() {
    const filteredData = getFilteredData();
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;

    // Garantir que a página atual não excede o total
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // Calcular índices de corte
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const currentItems = filteredData.slice(startIdx, endIdx);

    tableBody.innerHTML = '';

    if (totalItems === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">Nenhum cliente encontrado.</td></tr>`;
        paginationInfo.textContent = `Mostrando 0 de ${clientsData.length} clientes`;
        renderPaginationControls(1);
        return;
    }

    currentItems.forEach(client => {
        const tr = document.createElement('tr');

        let avatarHTML = '';
        if (client.avatarType === 'img') {
            avatarHTML = `<img src="${client.avatarSrc}" alt="${client.name}" class="client-avatar">`;
        } else {
            avatarHTML = `<div class="client-avatar-initials">${client.initials}</div>`;
        }

        const typeIcon = client.type === 'Pessoa Física' ? 'fa-user' : 'fa-building-columns';
        const statusClass = client.status.toLowerCase() === 'ativo' ? 'ativo' : 'inativo';

        tr.innerHTML = `
            <td>
                <div class="client-info-cell">
                    ${avatarHTML}
                    <div class="client-details">
                        <span class="client-name">${client.name}</span>
                        <span class="client-email">${client.email}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge-type"><i class="fa-solid ${typeIcon}"></i> ${client.type}</span>
            </td>
            <td>${client.contact}</td>
            <td>${client.city}</td>
            <td>${client.lastPurchase}</td>
            <td>
                <span class="badge-status ${statusClass}">${client.status}</span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn btn-view" data-id="${client.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn btn-edit" data-id="${client.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn btn-delete" data-id="${client.id}" title="Excluir"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Texto descritivo (ex: Mostrando 1 a 5 de 5 clientes)
    const showingStart = startIdx + 1;
    const showingEnd = Math.min(endIdx, totalItems);
    paginationInfo.textContent = `Mostrando ${showingStart} a ${showingEnd} de ${totalItems} clientes`;

    renderPaginationControls(totalPages);
    updateMetrics();
    attachActionEvents();
}

// Gerar os botões de paginação dinamicamente
function renderPaginationControls(totalPages) {
    if (!paginationControls) return;

    let html = `<button class="page-btn" id="prevPage" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;

    // Lógica para exibir números das páginas de forma limpa
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="page-dots">...</span>`;
        }
    }

    html += `<button class="page-btn" id="nextPage" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;

    paginationControls.innerHTML = html;

    // Adicionar eventos aos novos botões de página gerados
    document.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentPage = parseInt(e.currentTarget.getAttribute('data-page'));
            renderTable();
        });
    });

    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }
}

// Evento do botão "Cadastrar Cliente"
btnCadastrar.addEventListener('click', () => {
    modalTitle.textContent = "Cadastrar Novo Cliente";
    modalBodyContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <label>Nome Completo / Empresa: <input type="text" id="addName" placeholder="Ex: Ana Silva" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;"></label>
            <label>E-mail: <input type="email" id="addEmail" placeholder="exemplo@email.com" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;"></label>
            <label>Tipo de Cliente: 
                <select id="addType" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;">
                    <option value="Pessoa Física">Pessoa Física</option>
                    <option value="Pessoa Jurídica">Pessoa Jurídica</option>
                </select>
            </label>
            <label>Contato / Telefone: <input type="text" id="addContact" placeholder="(11) 90000-0000" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;"></label>
            <label>Cidade: <input type="text" id="addCity" placeholder="São Paulo - SP" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;"></label>
            <label>Status: 
                <select id="addStatus" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;">
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                </select>
            </label>
            <button id="saveNewClientBtn" style="background:#7c3aed; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:600; margin-top:8px;">Guardar Cliente</button>
        </div>
    `;
    openModal();

    document.getElementById('saveNewClientBtn').addEventListener('click', () => {
        const name = document.getElementById('addName').value.trim();
        const email = document.getElementById('addEmail').value.trim();
        const type = document.getElementById('addType').value;
        const contact = document.getElementById('addContact').value.trim();
        const city = document.getElementById('addCity').value.trim();
        const status = document.getElementById('addStatus').value;

        if (!name || !email) {
            alert("Por favor, preencha pelo menos o nome e o e-mail.");
            return;
        }

        const words = name.split(' ');
        const initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].substring(0, 2).toUpperCase();

        const newClient = {
            id: clientsData.length > 0 ? Math.max(...clientsData.map(c => c.id)) + 1 : 1,
            name: name,
            email: email,
            type: type,
            contact: contact || "(11) 00000-0000",
            city: city || "São Paulo - SP",
            lastPurchase: "Hoje",
            status: status,
            avatarType: "initials",
            initials: initials
        };

        clientsData.unshift(newClient);
        currentPage = 1; // Volta para a primeira página para ver o novo registo
        closeModal();
        renderTable();
    });
});

// Ações dos botões da tabela (Visualizar, Editar, Excluir)
function attachActionEvents() {
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const client = clientsData.find(c => c.id === id);
            if (client) {
                modalTitle.textContent = "Detalhes do Cliente";
                modalBodyContent.innerHTML = `
                    <p><strong>Nome:</strong> ${client.name}</p>
                    <p><strong>E-mail:</strong> ${client.email}</p>
                    <p><strong>Tipo:</strong> ${client.type}</p>
                    <p><strong>Contato:</strong> ${client.contact}</p>
                    <p><strong>Cidade:</strong> ${client.city}</p>
                    <p><strong>Última Compra:</strong> ${client.lastPurchase}</p>
                    <p><strong>Status:</strong> ${client.status}</p>
                `;
                openModal();
            }
        });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const client = clientsData.find(c => c.id === id);
            if (client) {
                modalTitle.textContent = "Editar Cliente";
                modalBodyContent.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <label>Nome: <input type="text" id="editName" value="${client.name}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;"></label>
                        <label>E-mail: <input type="email" id="editEmail" value="${client.email}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;"></label>
                        <label>Contato: <input type="text" id="editContact" value="${client.contact}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:6px;"></label>
                        <button id="saveEditBtn" style="background:#7c3aed; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:600; margin-top:8px;">Salvar Alterações</button>
                    </div>
                `;
                openModal();

                document.getElementById('saveEditBtn').addEventListener('click', () => {
                    client.name = document.getElementById('editName').value;
                    client.email = document.getElementById('editEmail').value;
                    client.contact = document.getElementById('editContact').value;
                    closeModal();
                    renderTable();
                });
            }
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const client = clientsData.find(c => c.id === id);
            if (client) {
                modalTitle.textContent = "Excluir Cliente";
                modalBodyContent.innerHTML = `
                    <p>Tem certeza de que deseja excluir o cliente <strong>${client.name}</strong>?</p>
                    <div style="display: flex; gap: 10px; margin-top: 16px;">
                        <button id="confirmDeleteBtn" style="background:#dc2626; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;">Sim, Excluir</button>
                    </div>
                `;
                openModal();

                document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                    clientsData = clientsData.filter(c => c.id !== id);
                    closeModal();
                    renderTable();
                });
            }
        });
    });
}

// Funções da modal
function openModal() {
    clientModal.classList.add('active');
}

function closeModal() {
    clientModal.classList.remove('active');
}

closeModalBtn.addEventListener('click', closeModal);
modalCloseAction.addEventListener('click', closeModal);
clientModal.addEventListener('click', (e) => {
    if (e.target === clientModal) closeModal();
});

// Filtros em tempo real
function handleFilters() {
    currentPage = 1; // Sempre que filtrar, volta à primeira página
    renderTable();
}

searchInput.addEventListener('input', handleFilters);
filterStatus.addEventListener('change', handleFilters);
filterCidade.addEventListener('change', handleFilters);
filterTipo.addEventListener('change', handleFilters);

btnLimparFiltros.addEventListener('click', () => {
    searchInput.value = '';
    filterStatus.value = '';
    filterCidade.value = '';
    filterTipo.value = '';
    currentPage = 1;
    renderTable();
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    renderTable();
});