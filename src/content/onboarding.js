// Onboarding flow
import { state, elements } from './state.js';
import { sendMessage, isExtensionValid } from './utils.js';

// Show a specific onboarding step
export function showOnboardingStep(step) {
    elements.onboardingSteps.forEach(s => s.classList.remove('active'));
    elements.onboardingDots.forEach(d => d.classList.remove('active'));

    const currentStepEl = elements.shadow.querySelector(`.vt-onboarding-step[data-step="${step}"]`);
    const currentDotEl = elements.shadow.querySelector(`.vt-onboarding-dot[data-step="${step}"]`);

    if (currentStepEl) currentStepEl.classList.add('active');
    if (currentDotEl) currentDotEl.classList.add('active');

    elements.onboardingNextBtn.textContent = step === state.onboardingTotalSteps ? 'Get Started' : 'Next';
    elements.onboardingSkipBtn.style.visibility = step === state.onboardingTotalSteps ? 'hidden' : 'visible';
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
            elements.onboardingOverlay.classList.add('active');
        }
    } catch (e) { }
}

// Setup onboarding listeners
export function setupOnboardingListeners() {
    elements.onboardingNextBtn.addEventListener('click', () => {
        if (state.onboardingCurrentStep < state.onboardingTotalSteps) {
            state.onboardingCurrentStep++;
            showOnboardingStep(state.onboardingCurrentStep);
        } else {
            closeOnboarding();
        }
    });

    elements.onboardingSkipBtn.addEventListener('click', closeOnboarding);

    if (elements.onboardingRefreshBtn) {
        elements.onboardingRefreshBtn.addEventListener('click', () => {
            elements.onboardingRefreshBtn.textContent = 'Refreshing...';
            elements.onboardingRefreshBtn.style.opacity = '0.5';
            elements.onboardingRefreshBtn.style.pointerEvents = 'none';
            sendMessage({ action: 'refresh-all-tabs' });
            setTimeout(() => {
                elements.onboardingRefreshBtn.textContent = 'Done!';
            }, 1000);
        });
    }

    if (isExtensionValid()) {
        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'show-onboarding') {
                    chrome.storage.local.set({ onboardingShown: true });
                    state.onboardingCurrentStep = 1;
                    showOnboardingStep(1);
                    elements.onboardingOverlay.classList.add('active');
                    sendResponse({ success: true });
                }
            });
        } catch (e) { }
    }
}
