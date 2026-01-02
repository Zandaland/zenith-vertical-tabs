// Onboarding flow
import { state, elements } from './state.js';
import { sendMessage, isExtensionValid } from './utils.js';

// Total steps in the new onboarding
const TOTAL_STEPS = 4;

// Update progress bar
function updateProgressBar(step) {
    const progressBar = elements.shadow.getElementById('vt-onboarding-progress-bar');
    if (progressBar) {
        const progress = (step / TOTAL_STEPS) * 100;
        progressBar.style.width = `${progress}%`;
    }
}

// Update step indicator
function updateStepIndicator(step) {
    const currentEl = elements.shadow.getElementById('vt-onboarding-step-current');
    if (currentEl) {
        currentEl.textContent = step;
    }
}

// Show a specific onboarding step
export function showOnboardingStep(step) {
    // Update steps
    elements.onboardingSteps.forEach(s => s.classList.remove('active'));
    const currentStepEl = elements.shadow.querySelector(`.vt-onboarding-step[data-step="${step}"]`);
    if (currentStepEl) currentStepEl.classList.add('active');

    // Update progress bar
    updateProgressBar(step);

    // Update step indicator
    updateStepIndicator(step);

    // Update button text
    if (step === TOTAL_STEPS) {
        elements.onboardingNextBtn.innerHTML = '<span>Get Started</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    } else {
        elements.onboardingNextBtn.innerHTML = '<span>Continue</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    }

    // Update skip button visibility
    elements.onboardingSkipBtn.style.visibility = step === TOTAL_STEPS ? 'hidden' : 'visible';
}

// Close onboarding
export async function closeOnboarding() {
    elements.onboardingOverlay.classList.remove('active');
    await chrome.storage.local.set({ onboardingShown: true });
}

// Check if onboarding should be shown
export async function checkOnboarding() {
    try {
        const result = await chrome.storage.local.get('onboardingShown');
        if (result.onboardingShown === false) {
            await chrome.storage.local.set({ onboardingShown: true });
            state.onboardingCurrentStep = 1;
            state.onboardingTotalSteps = TOTAL_STEPS;
            showOnboardingStep(1);
            elements.onboardingOverlay.classList.add('active');
        }
    } catch (e) { }
}

// Setup onboarding listeners
export function setupOnboardingListeners() {
    // Update total steps in state
    state.onboardingTotalSteps = TOTAL_STEPS;

    // Next button
    elements.onboardingNextBtn.addEventListener('click', () => {
        if (state.onboardingCurrentStep < TOTAL_STEPS) {
            state.onboardingCurrentStep++;
            showOnboardingStep(state.onboardingCurrentStep);
        } else {
            closeOnboarding();
        }
    });

    // Skip button
    elements.onboardingSkipBtn.addEventListener('click', closeOnboarding);

    // Refresh tabs button
    if (elements.onboardingRefreshBtn) {
        elements.onboardingRefreshBtn.addEventListener('click', () => {
            elements.onboardingRefreshBtn.textContent = 'Refreshing...';
            elements.onboardingRefreshBtn.style.opacity = '0.7';
            elements.onboardingRefreshBtn.style.pointerEvents = 'none';
            sendMessage({ action: 'refresh-all-tabs' });
            setTimeout(() => {
                elements.onboardingRefreshBtn.textContent = 'Done!';
            }, 1000);
        });
    }

    // Keyboard navigation
    elements.onboardingOverlay.addEventListener('keydown', (e) => {
        if (!elements.onboardingOverlay.classList.contains('active')) return;

        if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            if (state.onboardingCurrentStep < TOTAL_STEPS) {
                state.onboardingCurrentStep++;
                showOnboardingStep(state.onboardingCurrentStep);
            } else {
                closeOnboarding();
            }
        } else if (e.key === 'ArrowLeft' && state.onboardingCurrentStep > 1) {
            e.preventDefault();
            state.onboardingCurrentStep--;
            showOnboardingStep(state.onboardingCurrentStep);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeOnboarding();
        }
    });

    // Make overlay focusable for keyboard events
    elements.onboardingOverlay.setAttribute('tabindex', '0');

    // Listen for show-onboarding message
    if (isExtensionValid()) {
        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'show-onboarding') {
                    chrome.storage.local.set({ onboardingShown: true });
                    state.onboardingCurrentStep = 1;
                    showOnboardingStep(1);
                    elements.onboardingOverlay.classList.add('active');
                    elements.onboardingOverlay.focus();
                    sendResponse({ success: true });
                }
            });
        } catch (e) { }
    }
}
