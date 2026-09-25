// FILE: app/register/page.js — The registration page ("/register"), reached from "Get Pass" on the welcome page.
// Depends on: components/RegistrationForm, components/Brand.

import RegistrationForm from '@/components/RegistrationForm';
import { UiBackdrop, UiMasthead } from '@/components/Brand';

export const metadata = {
  title: 'Register — Manila Interior Design Summit',
};

/**
 * UiRegisterPage — centred card layout on the light neutral canvas.
 * @returns {JSX.Element}
 */
export default function UiRegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-16">
      <UiBackdrop />

      <div className="relative z-10 w-full max-w-lg">
        <UiMasthead />

        <RegistrationForm />

        <p className="mt-6 text-center text-xs text-slate-400">
          Questions? Contact the event organisers before the day.
        </p>
      </div>
    </main>
  );
}
