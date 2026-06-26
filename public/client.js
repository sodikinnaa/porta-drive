// App State
let state = {
  token: '',
  username: '',
  provider: 'gemini',
  geminiApiKey: '',
  openaiApiKey: '',
  openaiBaseUrl: '',
  openaiModel: '',
  activeTab: 'chats',
  conversations: [],
  activeConversationId: '',
  activeFolderId: '',
  activeFolderName: '',
  folderStructure: [],
  isLoadingChat: false
};

// DOM Elements
const elAppControlsContainer = document.getElementById('appControlsContainer');
const elBtnNewChat = document.getElementById('btnNewChat');
const elBtnConnectDrive = document.getElementById('btnConnectDrive');
const elTabChats = document.getElementById('tabChats');
const elTabFiles = document.getElementById('tabFiles');
const elChatsTabContent = document.getElementById('chatsTabContent');
const elFilesTabContent = document.getElementById('filesTabContent');
const elConversationList = document.getElementById('conversationList');

// Config DOM Elements
const elProviderSelect = document.getElementById('providerSelect');
const elGeminiConfigGroup = document.getElementById('geminiConfigGroup');
const elOpenaiConfigGroup = document.getElementById('openaiConfigGroup');
const elGeminiApiKey = document.getElementById('geminiApiKey');
const elOpenaiBaseUrl = document.getElementById('openaiBaseUrl');
const elOpenaiApiKey = document.getElementById('openaiApiKey');
const elBtnSaveKey = document.getElementById('btnSaveKey');
const elBtnTestConfig = document.getElementById('btnTestConfig');
const elSettingsModal = document.getElementById('settingsModal');
const elBtnOpenSettings = document.getElementById('btnOpenSettings');
const elCloseSettingsModal = document.getElementById('btnCloseSettingsModal');

const elProfileName = document.getElementById('profileName');
const elUserAvatar = document.getElementById('userAvatar');
const elBtnLogout = document.getElementById('btnLogout');

const elActiveFolderName = document.getElementById('activeFolderName');
const elActiveFolderStatus = document.getElementById('activeFolderStatus');
const elConnectionStatus = document.getElementById('connectionStatus');
const elChatHistory = document.getElementById('chatHistory');
const elChatInput = document.getElementById('chatInput');
const elChatForm = document.getElementById('chatForm');
const elBtnSend = document.getElementById('btnSend');
const elModelSelect = document.getElementById('modelSelect');
const elToolCallBanner = document.getElementById('toolCallBanner');
const elToolCallText = document.getElementById('toolCallText');

const elDriveModal = document.getElementById('driveModal');
const elCloseModal = document.getElementById('btnCloseModal');
const elCancelModal = document.getElementById('btnCancelModal');
const elConfirmScan = document.getElementById('btnConfirmScan');
const elModalFolderUrl = document.getElementById('modalFolderUrl');
const elModalRecursive = document.getElementById('modalRecursive');
const elFileCountBadge = document.getElementById('fileCountBadge');
const elExplorerContent = document.getElementById('explorerContent');
const elToast = document.getElementById('toast');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  // Authentication Guard: Redirect to login if token is missing
  const token = localStorage.getItem('pd_token');
  const username = localStorage.getItem('pd_username');

  if (!token || !username) {
    localStorage.clear();
    window.location.href = '/login';
    return;
  }

  state.token = token;
  state.username = username;
  
  // Load saved config values from localStorage
  state.provider = localStorage.getItem('pd_provider') || 'gemini';
  state.geminiApiKey = localStorage.getItem('pd_gemini_apikey') || '';
  state.openaiApiKey = localStorage.getItem('pd_openai_apikey') || '';
  state.openaiBaseUrl = localStorage.getItem('pd_openai_baseurl') || '';
  state.openaiModel = localStorage.getItem('pd_openai_model') || '';

  // Setup UI for authenticated user
  setLoggedInUI();
  
  // Load conversation data (shows skeleton during load)
  loadConversations();

  // Event Listeners
  elBtnLogout.addEventListener('click', handleLogout);
  elBtnSaveKey.addEventListener('click', handleSaveConfig);
  
  // Test connection button
  elBtnTestConfig.addEventListener('click', handleTestConfig);

  // Disable save button on any credentials modification
  const disableSave = () => {
    elBtnSaveKey.disabled = true;
    elBtnSaveKey.title = "Please test the connection first before saving.";
  };
  elGeminiApiKey.addEventListener('input', disableSave);
  elOpenaiBaseUrl.addEventListener('input', disableSave);
  elOpenaiApiKey.addEventListener('input', disableSave);

  // Model dropdown change listener
  elModelSelect.addEventListener('change', () => {
    const selectedModel = elModelSelect.value;
    localStorage.setItem(`pd_model_${state.provider}`, selectedModel);
    if (state.provider === 'openai_compatible') {
      state.openaiModel = selectedModel;
      localStorage.setItem('pd_openai_model', selectedModel);
      saveModelPreferenceSilently(selectedModel);
    }
  });
  
  // Provider Select listener
  elProviderSelect.addEventListener('change', () => {
    handleProviderChange();
    disableSave();
  });

  // Tabs
  elTabChats.addEventListener('click', () => switchTab('chats'));
  elTabFiles.addEventListener('click', () => switchTab('files'));

  // Modals
  elBtnConnectDrive.addEventListener('click', () => {
    if (!state.activeConversationId) {
      showToast('Please select or create a conversation first!', 'error');
      return;
    }
    elDriveModal.classList.remove('hidden');
  });

  const closeModal = () => elDriveModal.classList.add('hidden');
  elCloseModal.addEventListener('click', closeModal);
  elCancelModal.addEventListener('click', closeModal);
  elConfirmScan.addEventListener('click', handleScanDrive);

  // Settings Modal
  elBtnOpenSettings.addEventListener('click', () => {
    elSettingsModal.classList.remove('hidden');
  });
  elCloseSettingsModal.addEventListener('click', () => elSettingsModal.classList.add('hidden'));

  // Conversations
  elBtnNewChat.addEventListener('click', handleCreateNewChat);

  // Chat Form Submissions
  elChatForm.addEventListener('submit', handleSendChatMessage);
  
  elChatInput.addEventListener('input', () => {
    elChatInput.style.height = 'auto';
    elChatInput.style.height = (elChatInput.scrollHeight) + 'px';
  });

  elChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elChatForm.requestSubmit();
    }
  });
});

// Toast System
function showToast(message, type = 'info') {
  elToast.textContent = message;
  elToast.className = `toast ${type}`;
  elToast.classList.remove('hidden');
  setTimeout(() => elToast.classList.add('hidden'), 4000);
}

// Byte Formatter
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// File Icons
function getFileIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('audio')) return '🎵';
  if (mimeType.includes('video')) return '🎥';
  if (mimeType.includes('text') || mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('csv')) return '📝';
  if (mimeType.includes('vnd.google-apps.document')) return '📝';
  if (mimeType.includes('vnd.google-apps.spreadsheet')) return '📊';
  if (mimeType.includes('vnd.google-apps.folder')) return '📁';
  return '📄';
}

// UI State Init
function setLoggedInUI() {
  elProfileName.textContent = state.username;
  elUserAvatar.textContent = state.username.substring(0,2).toUpperCase();
  
  // Populate settings fields
  elProviderSelect.value = state.provider;
  elGeminiApiKey.value = state.geminiApiKey;
  elOpenaiBaseUrl.value = state.openaiBaseUrl;
  elOpenaiApiKey.value = state.openaiApiKey;
  
  // Toggle input groups dynamically
  toggleConfigInputs(state.provider);

  elChatInput.placeholder = "Select a conversation from the sidebar...";
  
  // Fetch available models from API key (Acts as initial auth check)
  fetchAvailableModels();
}

function handleProviderChange() {
  const provider = elProviderSelect.value;
  toggleConfigInputs(provider);
}

function toggleConfigInputs(provider) {
  if (provider === 'gemini') {
    elGeminiConfigGroup.classList.remove('hidden');
    elOpenaiConfigGroup.classList.add('hidden');
  } else {
    elGeminiConfigGroup.classList.add('hidden');
    elOpenaiConfigGroup.classList.remove('hidden');
  }
}

// Fetch available models from server API (test authorization check)
async function fetchAvailableModels() {
  // Reset and show loader skeleton in modelSelect dropdown
  elModelSelect.innerHTML = '<option value="" disabled selected>Loading models...</option>';
  elModelSelect.disabled = true;
  
  // Disable chat while validating
  if (state.activeConversationId) {
    elChatInput.disabled = true;
    elBtnSend.disabled = true;
    elChatInput.placeholder = "Validating provider credentials...";
  }

  try {
    const res = await fetch('/api/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      return;
    }
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch models');

    // Populate modelSelect
    elModelSelect.innerHTML = '';
    
    if (!data.models || data.models.length === 0) {
      elModelSelect.innerHTML = '<option value="" disabled selected>No models available (check key)</option>';
      throw new Error('API key is authenticated but returned 0 available models.');
    }

    data.models.forEach(model => {
      const opt = document.createElement('option');
      opt.value = model.id;
      opt.textContent = model.displayName;
      elModelSelect.appendChild(opt);
    });

    elModelSelect.disabled = false;
    
    // Select default if saved
    const savedModel = localStorage.getItem(`pd_model_${state.provider}`);
    if (savedModel) {
      const hasMatch = Array.from(elModelSelect.options).some(o => o.value === savedModel);
      if (hasMatch) {
        elModelSelect.value = savedModel;
      } else {
        elModelSelect.selectedIndex = 0;
      }
    } else if (state.provider === 'openai_compatible' && state.openaiModel) {
      const hasMatch = Array.from(elModelSelect.options).some(o => o.value === state.openaiModel);
      if (hasMatch) elModelSelect.value = state.openaiModel;
    } else {
      elModelSelect.selectedIndex = 0;
    }

    // Enable chat inputs
    if (state.activeConversationId) {
      elChatInput.disabled = false;
      elBtnSend.disabled = false;
      elChatInput.placeholder = "Ask about the folder contents...";
    }

  } catch (err) {
    console.error(err);
    elModelSelect.innerHTML = '<option value="" disabled selected>❌ Key Error</option>';
    elModelSelect.disabled = true;
    
    if (state.activeConversationId) {
      elChatInput.disabled = true;
      elBtnSend.disabled = true;
      elChatInput.placeholder = "Configure credentials below to start chatting...";
    }
    showToast(`Auth Failed: ${err.message}`, 'error');
  }
}

// ========================================================
// SKELETON LOADERS
// ========================================================
function showConvoSkeletons() {
  elConversationList.innerHTML = Array(4).fill(0).map(() => `
    <div class="skeleton-convo">
      <div class="skeleton-icon skeleton"></div>
      <div style="flex-grow: 1;">
        <div class="skeleton-title skeleton"></div>
        <div class="skeleton-title-short skeleton"></div>
      </div>
    </div>
  `).join('');
}

function showFileSkeletons() {
  elExplorerContent.innerHTML = Array(6).fill(0).map((_, i) => `
    <div class="skeleton-tree-item" style="margin-left: ${10 + (i % 3) * 12}px">
      <div class="skeleton-tree-icon skeleton"></div>
      <div class="skeleton-tree-name skeleton"></div>
    </div>
  `).join('');
}

function showChatLoadingSkeleton() {
  const loader = document.createElement('div');
  loader.id = 'aiChatLoaderSkeleton';
  loader.className = 'message message-ai';
  loader.innerHTML = `
    <div class="message-avatar skeleton"></div>
    <div class="skeleton-bubble">
      <div class="skeleton-line skeleton"></div>
      <div class="skeleton-line-mid skeleton"></div>
      <div class="skeleton-line-short skeleton"></div>
    </div>
  `;
  elChatHistory.appendChild(loader);
  scrollToBottom();
}

function removeChatLoadingSkeleton() {
  const loader = document.getElementById('aiChatLoaderSkeleton');
  if (loader) loader.remove();
}

// Auth Actions
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
  } catch (err) {}

  localStorage.clear();
  window.location.href = '/login';
}

async function handleSaveConfig() {
  const provider = elProviderSelect.value;
  const geminiApiKey = elGeminiApiKey.value.trim();
  const openaiApiKey = elOpenaiApiKey.value.trim();
  const openaiBaseUrl = elOpenaiBaseUrl.value.trim();
  // Get active model from elModelSelect or state fallback
  const activeModel = elModelSelect.value || '';

  // Basic validation
  if (provider === 'gemini' && !geminiApiKey) {
    showToast('Gemini API Key is required for Gemini provider', 'error');
    return;
  }
  if (provider === 'openai_compatible' && (!openaiApiKey || !openaiBaseUrl)) {
    showToast('Base URL and API Key are required for OpenAI compatible provider', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/update-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        provider,
        geminiApiKey,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel: activeModel
      })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update configuration');
    }

    // Save to state
    state.provider = provider;
    state.geminiApiKey = geminiApiKey;
    state.openaiApiKey = openaiApiKey;
    state.openaiBaseUrl = openaiBaseUrl;
    state.openaiModel = activeModel;

    // Save to localStorage
    localStorage.setItem('pd_provider', provider);
    localStorage.setItem('pd_gemini_apikey', geminiApiKey);
    localStorage.setItem('pd_openai_apikey', openaiApiKey);
    localStorage.setItem('pd_openai_baseurl', openaiBaseUrl);
    localStorage.setItem('pd_openai_model', activeModel);
    localStorage.setItem(`pd_model_${provider}`, activeModel);

    showToast('Configuration saved successfully!', 'success');
    
    // Disable save key since it is now successfully saved
    elBtnSaveKey.disabled = true;

    // Auto-close settings modal on success
    setTimeout(() => {
      elSettingsModal.classList.add('hidden');
    }, 500);

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleTestConfig() {
  const provider = elProviderSelect.value;
  const geminiApiKey = elGeminiApiKey.value.trim();
  const openaiApiKey = elOpenaiApiKey.value.trim();
  const openaiBaseUrl = elOpenaiBaseUrl.value.trim();

  if (provider === 'gemini' && !geminiApiKey) {
    showToast('Gemini API Key is required to test connection', 'error');
    return;
  }
  if (provider === 'openai_compatible' && (!openaiApiKey || !openaiBaseUrl)) {
    showToast('Base URL and API Key are required to test connection', 'error');
    return;
  }

  elBtnTestConfig.disabled = true;
  const elTestSpinner = document.getElementById('testSpinner');
  if (elTestSpinner) elTestSpinner.classList.remove('hidden');

  try {
    const res = await fetch('/api/models/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        provider,
        geminiApiKey,
        openaiApiKey,
        openaiBaseUrl
      })
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to test connection');

    if (provider === 'openai_compatible' && data.baseUrl) {
      elOpenaiBaseUrl.value = data.baseUrl;
    }

    if (!data.models || data.models.length === 0) {
      throw new Error('Authorized successfully but returned 0 available models.');
    }

    // Populate modelSelect
    elModelSelect.innerHTML = '';
    data.models.forEach(model => {
      const opt = document.createElement('option');
      opt.value = model.id;
      opt.textContent = model.displayName;
      elModelSelect.appendChild(opt);
    });

    elModelSelect.disabled = false;
    elModelSelect.selectedIndex = 0;

    // Enable Save button since connection test validated successfully
    elBtnSaveKey.disabled = false;
    elBtnSaveKey.title = "Save configuration";

    showToast('Connection test succeeded! Models populated, you can now save.', 'success');

    // Enable chat inputs if active conversation
    if (state.activeConversationId) {
      elChatInput.disabled = false;
      elBtnSend.disabled = false;
      elChatInput.placeholder = "Ask about the folder contents...";
    }

  } catch (err) {
    showToast(`Test Failed: ${err.message}`, 'error');
    elBtnSaveKey.disabled = true;
    elModelSelect.innerHTML = '<option value="" disabled selected>❌ Key Error</option>';
    elModelSelect.disabled = true;
    
    if (state.activeConversationId) {
      elChatInput.disabled = true;
      elBtnSend.disabled = true;
      elChatInput.placeholder = "Configure credentials below to start chatting...";
    }
  } finally {
    elBtnTestConfig.disabled = false;
    if (elTestSpinner) elTestSpinner.classList.add('hidden');
  }
}

async function saveModelPreferenceSilently(model) {
  try {
    await fetch('/api/auth/update-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        provider: state.provider,
        geminiApiKey: state.geminiApiKey,
        openaiApiKey: state.openaiApiKey,
        openaiBaseUrl: state.openaiBaseUrl,
        openaiModel: model
      })
    });
  } catch (err) {
    console.error('Failed to auto-save model preference:', err);
  }
}

// Tab Swapper
function switchTab(tab) {
  state.activeTab = tab;
  if (tab === 'chats') {
    elTabChats.classList.add('active');
    elTabFiles.classList.remove('active');
    elChatsTabContent.classList.remove('hidden');
    elFilesTabContent.classList.add('hidden');
  } else {
    elTabChats.classList.remove('active');
    elTabFiles.classList.add('active');
    elChatsTabContent.classList.add('hidden');
    elFilesTabContent.classList.remove('hidden');
    
    if (state.activeFolderId) {
      if (state.folderStructure.length > 0) {
        renderFolderTree(state.folderStructure, state.activeFolderId);
      } else {
        showFileSkeletons();
      }
    } else {
      elExplorerContent.innerHTML = '<div class="empty-state"><p>Connect a folder to explore its files.</p></div>';
    }
  }
}

// Conversations Management
async function loadConversations() {
  showConvoSkeletons();

  try {
    const res = await fetch('/api/conversations', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load conversations');

    await new Promise(resolve => setTimeout(resolve, 400));

    state.conversations = data.conversations;
    renderConversationList();

    const savedActiveId = localStorage.getItem('pd_active_conversation_id');
    if (savedActiveId && data.conversations.some(c => c.id === savedActiveId)) {
      selectConversation(savedActiveId);
    } else if (data.conversations.length > 0) {
      selectConversation(data.conversations[0].id);
    } else {
      resetChatWindow();
    }
  } catch (err) {
    showToast(err.message, 'error');
    elConversationList.innerHTML = '<div class="empty-state"><p class="error-text">Failed to load chats</p></div>';
  }
}

function renderConversationList() {
  elConversationList.innerHTML = '';
  
  if (state.conversations.length === 0) {
    elConversationList.innerHTML = '<div class="empty-state"><p style="font-size: 11px;">No chats yet. Click "New Chat"!</p></div>';
    return;
  }

  state.conversations.forEach(convo => {
    const item = document.createElement('div');
    item.className = `convo-item ${convo.id === state.activeConversationId ? 'active' : ''}`;
    
    const icon = document.createElement('span');
    icon.className = 'convo-icon';
    icon.textContent = convo.folder_id ? '📁' : '💬';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'convo-title-container';
    
    const title = document.createElement('span');
    title.className = 'convo-title';
    title.textContent = convo.title;
    
    titleContainer.appendChild(title);
    
    if (convo.folder_name) {
      const subtitle = document.createElement('span');
      subtitle.className = 'convo-subtitle';
      subtitle.textContent = convo.folder_name;
      titleContainer.appendChild(subtitle);
    }

    const actions = document.createElement('div');
    actions.className = 'convo-actions';
    
    const btnDel = document.createElement('button');
    btnDel.className = 'convo-action-btn';
    btnDel.title = 'Delete Chat';
    btnDel.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteConversation(convo.id);
    });

    actions.appendChild(btnDel);
    
    item.appendChild(icon);
    item.appendChild(titleContainer);
    item.appendChild(actions);

    item.addEventListener('click', () => {
      selectConversation(convo.id);
    });

    elConversationList.appendChild(item);
  });
}

function resetChatWindow() {
  state.activeConversationId = '';
  state.activeFolderId = '';
  state.activeFolderName = '';
  state.folderStructure = [];
  
  elActiveFolderName.textContent = 'PortaDrive AI';
  elActiveFolderStatus.textContent = 'Create a conversation to begin';
  elConnectionStatus.textContent = 'Disconnected';
  elConnectionStatus.className = 'badge status-badge offline';
  
  elChatInput.disabled = true;
  elBtnSend.disabled = true;
  elChatInput.placeholder = "Select or create a conversation...";
  elFileCountBadge.classList.add('hidden');
  elExplorerContent.innerHTML = '<div class="empty-state"><p>Scan a folder to explore files.</p></div>';
  
  elChatHistory.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">💬</div>
      <h2>PortaDrive Workspace</h2>
      <p>Log in, save your personal Gemini API Key, connect a public Google Drive folder, and analyze files like PDFs and images using tool calling.</p>
      <div class="welcome-actions">
        <button id="btnWelcomeNewChat" class="btn btn-primary">➕ Start a New Chat</button>
      </div>
    </div>
  `;
  
  const welcomeBtn = document.getElementById('btnWelcomeNewChat');
  if (welcomeBtn) {
    welcomeBtn.addEventListener('click', handleCreateNewChat);
  }
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function handleCreateNewChat() {
  const id = generateUUID();
  const title = `Chat ${state.conversations.length + 1}`;
  
  try {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ id, title, folderId: null, folderName: null })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create chat');
    }

    state.conversations.unshift({ id, title, folder_id: null, folder_name: null });
    renderConversationList();
    selectConversation(id);
    showToast('New conversation created!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteConversation(id) {
  if (!confirm('Are you sure you want to delete this conversation?')) return;
  
  try {
    const res = await fetch('/api/conversations/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ id })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete chat');
    }

    state.conversations = state.conversations.filter(c => c.id !== id);
    renderConversationList();
    
    if (state.activeConversationId === id) {
      if (state.conversations.length > 0) {
        selectConversation(state.conversations[0].id);
      } else {
        resetChatWindow();
      }
    }
    showToast('Chat deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function selectConversation(id) {
  state.activeConversationId = id;
  localStorage.setItem('pd_active_conversation_id', id);
  const convo = state.conversations.find(c => c.id === id);
  if (!convo) return;

  renderConversationList();

  state.activeFolderId = convo.folder_id || '';
  state.activeFolderName = convo.folder_name || '';
  
  elActiveFolderName.textContent = convo.title;
  if (state.activeFolderId) {
    elActiveFolderStatus.textContent = `Linked folder: ${state.activeFolderName} (${state.activeFolderId})`;
    elConnectionStatus.textContent = 'Connected';
    elConnectionStatus.className = 'badge status-badge online';
  } else {
    elActiveFolderStatus.textContent = 'No Google Drive folder linked';
    elConnectionStatus.textContent = 'No Folder';
    elConnectionStatus.className = 'badge status-badge offline';
  }

  // Set chat fields disabled state based on model selection validity
  if (elModelSelect.disabled) {
    elChatInput.disabled = true;
    elBtnSend.disabled = true;
    elChatInput.placeholder = "Configure credentials below to start chatting...";
  } else {
    elChatInput.disabled = false;
    elBtnSend.disabled = false;
    elChatInput.placeholder = "Ask about the folder contents...";
  }

  elChatHistory.innerHTML = '';
  showChatLoadingSkeleton();
  
  try {
    const res = await fetch('/api/conversations/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load messages');

    removeChatLoadingSkeleton();
    elChatHistory.innerHTML = '';
    
    if (data.messages.length === 0) {
      appendSystemMessage(`Conversation started. Connect a folder to begin parsing!`);
    } else {
      data.messages.forEach(msg => {
        if (msg.role === 'function') return;
        
        if (msg.role === 'model') {
          appendMessage('model', msg.content || 'Reading files...', msg.toolCalls);
        } else {
          appendMessage('user', msg.content);
        }
      });
    }

    if (state.activeFolderId) {
      elFileCountBadge.classList.add('hidden');
      fetchFolderStructureCached(state.activeFolderId);
    } else {
      elFileCountBadge.classList.add('hidden');
      elExplorerContent.innerHTML = '<div class="empty-state"><p>No folder connected to this chat.</p></div>';
    }

  } catch (err) {
    removeChatLoadingSkeleton();
    showToast(err.message, 'error');
    elChatHistory.innerHTML = `<div class="empty-state"><p class="error-text">❌ Failed to load messages: ${err.message}</p></div>`;
  }
}

async function fetchFolderStructureCached(folderId) {
  if (state.activeTab === 'files') {
    showFileSkeletons();
  }

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ folderUrl: folderId, recursive: true })
    });
    const data = await res.json();
    if (!res.ok) return;

    state.folderStructure = data.items;
    elFileCountBadge.textContent = `${data.items.length} items`;
    elFileCountBadge.classList.remove('hidden');

    if (state.activeTab === 'files') {
      renderFolderTree(state.folderStructure, state.activeFolderId);
    }
  } catch (err) {}
}

async function handleScanDrive() {
  const urlOrId = elModalFolderUrl.value.trim();
  const recursive = elModalRecursive.checked;
  
  if (!urlOrId) {
    showToast('Please enter a Google Drive link or ID', 'error');
    return;
  }

  elConfirmScan.disabled = true;
  elConfirmScan.querySelector('.btn-text').textContent = 'Connecting...';
  elConfirmScan.querySelector('.spinner').classList.remove('hidden');

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ folderUrl: urlOrId, recursive })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to scan folder');

    state.activeFolderId = data.folderId;
    state.activeFolderName = data.folderName;
    state.folderStructure = data.items;

    const activeConvo = state.conversations.find(c => c.id === state.activeConversationId);
    if (activeConvo) {
      activeConvo.folder_id = data.folderId;
      activeConvo.folder_name = data.folderName;
      activeConvo.title = `Study: ${data.folderName}`;
      
      await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({
          id: state.activeConversationId,
          title: activeConvo.title,
          folderId: data.folderId,
          folderName: data.folderName
        })
      });

      renderConversationList();
      selectConversation(state.activeConversationId);
    }

    elDriveModal.classList.add('hidden');
    showToast(`Linked drive folder successfully!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    elConfirmScan.disabled = false;
    elConfirmScan.querySelector('.btn-text').textContent = 'Scan & Connect';
    elConfirmScan.querySelector('.spinner').classList.add('hidden');
  }
}

function renderFolderTree(items, rootId) {
  elExplorerContent.innerHTML = '';

  if (items.length === 0) {
    elExplorerContent.innerHTML = '<div class="empty-state"><p>No items found. Ensure the folder is public.</p></div>';
    return;
  }

  const sorted = [...items].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  const buildTree = (parentId) => {
    const children = sorted.filter(item => {
      if (item.parentId === parentId) return true;
      if (parentId === rootId && (!item.parentId || !sorted.some(x => x.id === item.parentId))) return true;
      return false;
    });

    if (children.length === 0) return null;

    const treeContainer = document.createElement('div');
    treeContainer.className = 'tree-children';

    children.forEach(child => {
      const node = document.createElement('div');
      node.className = 'tree-node';

      const row = document.createElement('div');
      row.className = `tree-row ${child.isFolder ? 'tree-folder' : 'tree-file'}`;
      row.dataset.id = child.id;

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = child.isFolder ? '📁' : getFileIcon(child.mimeType);

      const name = document.createElement('span');
      name.className = 'tree-name';
      name.textContent = child.name;

      row.appendChild(icon);
      row.appendChild(name);

      if (!child.isFolder && child.size !== null) {
        const sizeBadge = document.createElement('span');
        sizeBadge.className = 'tree-size';
        sizeBadge.textContent = formatBytes(child.size);
        row.appendChild(sizeBadge);
      }

      node.appendChild(row);

      if (child.isFolder) {
        const childTree = buildTree(child.id);
        if (childTree) {
          node.appendChild(childTree);
        }
      }

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.tree-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        showFileDetailsToast(child);
      });

      treeContainer.appendChild(node);
    });

    return treeContainer;
  };

  const rootTree = buildTree(rootId);
  if (rootTree) {
    elExplorerContent.appendChild(rootTree);
  } else {
    const list = document.createElement('div');
    list.className = 'tree-children';
    sorted.forEach(item => {
      const row = document.createElement('div');
      row.className = `tree-row ${item.isFolder ? 'tree-folder' : 'tree-file'}`;
      row.innerHTML = `<span class="tree-icon">${item.isFolder ? '📁' : '📄'}</span><span class="tree-name">${item.name}</span>`;
      row.addEventListener('click', () => showFileDetailsToast(item));
      list.appendChild(row);
    });
    elExplorerContent.appendChild(list);
  }
}

function showFileDetailsToast(item) {
  let details = `Selected: ${item.name}`;
  if (!item.isFolder) {
    details += ` (${formatBytes(item.size)})`;
  }
  showToast(details, 'info');
  
  if (elChatInput.value.trim() === '') {
    elChatInput.value = `Read file "${item.name}" (ID: ${item.id})`;
    elChatInput.focus();
  }
}

// Chat functions
function appendSystemMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'message message-ai';
  msg.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-content">
      <p style="color: var(--accent); font-style: italic; font-weight: 500;">${text}</p>
    </div>
  `;
  elChatHistory.appendChild(msg);
  scrollToBottom();
}

function appendMessage(sender, text, toolCalls = []) {
  const msg = document.createElement('div');
  msg.className = `message message-${sender === 'user' ? 'user' : 'ai'}`;
  
  const avatar = sender === 'user' ? 'U' : 'AI';
  
  let toolCallsHtml = '';
  if (toolCalls && toolCalls.length > 0) {
    toolCallsHtml = `
      <div class="message-tool-calls">
        ${toolCalls.map(tc => `
          <div class="tool-call-badge">
            ⚙️ <strong>Tool Call:</strong> ${tc.name}(${JSON.stringify(tc.args)})
          </div>
        `).join('')}
      </div>
    `;
  }

  const parsedText = parseMarkdown(text);

  msg.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      ${parsedText}
      ${toolCallsHtml}
    </div>
  `;
  elChatHistory.appendChild(msg);
  scrollToBottom();
}

function scrollToBottom() {
  elChatHistory.scrollTop = elChatHistory.scrollHeight;
}

// Markdown parser
function parseMarkdown(text) {
  if (!text) return '';
  
  let html = text;
  
  // Escape HTML tags to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Images: ![alt](src)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="chat-generated-image" style="max-width: 100%; border-radius: 8px; margin-top: 8px; border: 1px solid var(--border);" />');

  // Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Headers: #, ##, ###
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Bullet Lists (support -, *, and +)
  html = html.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  html = html.replace(/<\/ul>\s*<ul>/g, ''); // Merge consecutive ul blocks

  // Numbered Lists (support 1., 2., etc.)
  html = html.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<li value="$1">$2</li>');
  html = html.replace(/(<li value="\d+">[\s\S]*?<\/li>)/g, (match) => {
    return `<ol>${match}</ol>`;
  });
  html = html.replace(/<\/ol>\s*<ol>/g, ''); // Merge consecutive ol blocks

  // Bold: **text**
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');

  // Italics: *text*
  html = html.replace(/\*([\s\S]*?)\*/g, '<em>$1</em>');

  // Paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<ul>') || p.startsWith('<ol') || p.startsWith('<ol>')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// Send Chat Message
async function handleSendChatMessage(e) {
  e.preventDefault();
  
  const text = elChatInput.value.trim();
  if (!text) return;

  // Validation based on active Provider
  if (state.provider === 'gemini' && !state.geminiApiKey) {
    showToast('Please save your Gemini API Key in the settings panel first.', 'error');
    elGeminiApiKey.focus();
    return;
  }
  if (state.provider === 'openai_compatible' && !state.openaiApiKey) {
    showToast('Please save your OpenAI Compatible API Key in settings first.', 'error');
    elOpenaiApiKey.focus();
    return;
  }

  // Renders User message
  appendMessage('user', text);

  // Clear input
  elChatInput.value = '';
  elChatInput.style.height = 'auto';
  elChatInput.disabled = true;
  elBtnSend.disabled = true;

  // Show skeleton loading
  showChatLoadingSkeleton();

  // Show active tool call banner
  elToolCallText.textContent = `AI is evaluating prompt (${state.provider})...`;
  elToolCallBanner.classList.remove('hidden');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        conversationId: state.activeConversationId,
        message: text,
        folderId: state.activeFolderId,
        folderStructure: state.folderStructure,
        modelName: elModelSelect.value // Send selected model name
      })
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to complete chat response');

    // Remove skeleton
    removeChatLoadingSkeleton();
    elToolCallBanner.classList.add('hidden');

    // Append AI response
    appendMessage('model', data.text, data.toolCalls);

  } catch (err) {
    console.error(err);
    removeChatLoadingSkeleton();
    elToolCallBanner.classList.add('hidden');
    showToast(err.message, 'error');
    appendSystemMessage(`Error: ${err.message}`);
  } finally {
    // Only enable if modelSelect is valid
    if (!elModelSelect.disabled) {
      elChatInput.disabled = false;
      elBtnSend.disabled = false;
    }
    elChatInput.focus();
  }
}
