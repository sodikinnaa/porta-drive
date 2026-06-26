window.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  const token = localStorage.getItem('pd_token');
  if (token) {
    window.location.href = '/app';
    return;
  }

  const form = document.getElementById('registerForm');
  const btnSubmit = document.getElementById('btnRegisterSubmit');
  const spinner = document.getElementById('registerSpinner');
  const toast = document.getElementById('toast');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    // Loading State
    btnSubmit.disabled = true;
    btnSubmit.querySelector('.btn-text').textContent = 'Registering...';
    spinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      showToast('Registration successful! Redirecting to login...', 'success');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);

    } catch (err) {
      showToast(err.message, 'error');
      btnSubmit.disabled = false;
      btnSubmit.querySelector('.btn-text').textContent = 'Register Account';
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
