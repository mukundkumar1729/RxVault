// ════════════════════════════════════════════════════════════
//  AUTH VIEW CONTROLLER
//  Safely injects Authentication login panels into the overlay
// ════════════════════════════════════════════════════════════

import { el, emptyNode } from '../utils/dom.js';
import { authLogin, authLogout } from '../services/authService.js';

export const executeAuthGate = () => {
    const gate = document.getElementById('loginGate');
    if (gate) { 
        gate.classList.add('open'); 
        document.body.style.overflow = 'hidden'; 
    }
    renderLoginFormSafe();
};

export const hideAuthGate = () => {
    const gate = document.getElementById('loginGate');
    if (gate) gate.classList.remove('open');
    document.body.style.overflow = '';
};

export const renderLoginFormSafe = () => {
    const body = document.getElementById('loginGateBody');
    if (!body) return;
    emptyNode(body);

    const submitLogin = async () => {
        const email = document.getElementById('loginEmail')?.value || '';
        const pwd = document.getElementById('loginPassword')?.value || '';
        const btn = document.getElementById('loginBtn');
        const err = document.getElementById('loginError');

        if (!email || !pwd) {
            if (err) err.textContent = 'Please enter both email and password.';
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = '⏳ Authenticating…'; }
        if (err) err.textContent = '';

        const res = await authLogin(email, pwd);

        if (btn) { btn.disabled = false; btn.textContent = '🔓 Sign In'; }

        if (!res.success) {
            if (err) err.textContent = res.error;
            return;
        }

        // Wipe gate
        hideAuthGate();
        
        // Reboot application to map routes
        window.location.reload(); 
    };

    const logo = el('div', { className: 'login-logo', textContent: '💊' });
    const brand = el('div', { className: 'login-brand', textContent: 'Rx Vault' });
    const sub = el('div', { className: 'login-sub', textContent: 'Medical Record Manager · Secure Sign In' });

    const formWrapper = el('div', { className: 'login-form' });

    // Email
    const emailField = el('div', { className: 'field' }, [
        el('label', { textContent: 'Email' }),
        el('input', { 
            id: 'loginEmail', 
            type: 'email', 
            attributes: { placeholder: 'admin@rxvault.in', autocomplete: 'email' },
            onkeydown: (e) => { if (e.key === 'Enter') document.getElementById('loginPassword')?.focus(); }
        })
    ]);

    // Password
    const pwdWrapper = el('div', { style: { position: 'relative' } }, [
        el('input', { 
            id: 'loginPassword', 
            type: 'password', 
            attributes: { placeholder: '••••••••', autocomplete: 'current-password' },
            onkeydown: (e) => { if (e.key === 'Enter') submitLogin(); }
        }),
        el('button', { 
            type: 'button', 
            className: 'login-pwd-toggle', 
            attributes: { title: 'Show/hide' }, 
            textContent: '👁',
            onClick: () => {
                const p = document.getElementById('loginPassword');
                p.type = p.type === 'password' ? 'text' : 'password';
            }
        })
    ]);
    const pwdField = el('div', { className: 'field', style: { marginTop: '12px' } }, [
        el('label', { textContent: 'Password' }),
        pwdWrapper
    ]);

    // Errors & Buttons
    const errPanel = el('div', { id: 'loginError', className: 'login-error' });
    
    const btnSubmit = el('button', { id: 'loginBtn', className: 'login-btn', textContent: '🔓 Sign In', onClick: submitLogin });
    const btnForgot = el('button', { type: 'button', className: 'login-forgot-link', textContent: '🔑 Forgot Password?', onClick: () => alert('Contact System SuperAdmin to reset password for RxVault.') });

    formWrapper.appendChild(emailField);
    formWrapper.appendChild(pwdField);
    formWrapper.appendChild(errPanel);
    formWrapper.appendChild(btnSubmit);
    formWrapper.appendChild(btnForgot);

    const footer = el('div', { className: 'login-footer', textContent: 'Rx Vault · Secure Medical Records' });

    body.appendChild(logo);
    body.appendChild(brand);
    body.appendChild(sub);
    body.appendChild(formWrapper);
    body.appendChild(footer);

    setTimeout(() => { document.getElementById('loginEmail')?.focus(); }, 150);
};
