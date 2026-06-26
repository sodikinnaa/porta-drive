window.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  const token = localStorage.getItem('pd_token');
  if (token) {
    window.location.href = '/';
    return;
  }

  const form = document.getElementById('loginForm');
  const btnSubmit = document.getElementById('btnLoginSubmit');
  const spinner = document.getElementById('loginSpinner');
  const toast = document.getElementById('toast');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Loading State
    btnSubmit.disabled = true;
    btnSubmit.querySelector('.btn-text').textContent = 'Logging in...';
    spinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Login failed');

      // Save credentials and configuration
      localStorage.setItem('pd_token', data.token);
      localStorage.setItem('pd_username', data.username);
      localStorage.setItem('pd_provider', data.provider || 'gemini');
      localStorage.setItem('pd_gemini_apikey', data.geminiApiKey || '');
      localStorage.setItem('pd_openai_apikey', data.openaiApiKey || '');
      localStorage.setItem('pd_openai_baseurl', data.openaiBaseUrl || '');
      localStorage.setItem('pd_openai_model', data.openaiModel || '');

      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);

    } catch (err) {
      showToast(err.message, 'error');
      btnSubmit.disabled = false;
      btnSubmit.querySelector('.btn-text').textContent = 'Log In';
      spinner.classList.add('hidden');
    }
  });

  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }
});
