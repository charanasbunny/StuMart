import { Link } from "react-router";

const PHONE = "9392668228";
const EMAIL = "gvlpolymart@gmail.com";
const PHONE_LINK = `tel:+91${PHONE}`;
const EMAIL_LINK = `mailto:${EMAIL}`;

const COLLEGE_ADDRESS = {
  name: "A.A.N.M. & V.V.R.S.R. Polytechnic",
  line1: "Seshadri Rao Knowledge Village",
  line2: "Gudlavalleru, Krishna District",
  state: "Andhra Pradesh – 521356",
  mapUrl: "https://www.google.com/maps/search/A.A.N.M.+V.V.R.S.R.+Polytechnic+Gudlavalleru",
};

const SOCIAL_LINKS = [
  { name: "College Website", href: "https://aanm-vvrsrpolytechnic.ac.in", icon: "website" },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/aanm-vvrsr-poly030/", icon: "linkedin" },
  { name: "Instagram", href: "https://www.instagram.com/aanm.vvrsr.polytechnic/", icon: "instagram" },
];

function IconPhone() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconLocation() {
  return (
    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-14 md:py-24">
        {/* Header */}
        <header className="text-center mb-12 sm:mb-14 md:mb-16">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 mb-3">
            Contact
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-3 sm:mb-4">
            Get in touch
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
            Reach out for support, feedback, or partnerships. GvlPolyMart serves AANM & VVRSR Polytechnic.
          </p>
        </header>

        {/* Primary contact */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Primary contact
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href={PHONE_LINK}
              className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all"
            >
              <span className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-400 text-white shadow-md flex items-center justify-center">
                <IconPhone />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Phone / WhatsApp</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{PHONE}</p>
              </div>
            </a>
            <a
              href={EMAIL_LINK}
              className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all"
            >
              <span className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white shadow-md flex items-center justify-center">
                <IconMail />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Email</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{EMAIL}</p>
              </div>
            </a>
          </div>
        </section>

        {/* College address */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            College address
          </h2>
          <div
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 hover:border-indigo-100 hover:shadow-md transition-all"
          >
            <div className="flex gap-4">
              <span className="flex-shrink-0 text-gray-300 mt-0.5">
                <IconLocation />
              </span>
              <address className="not-italic text-sm sm:text-base text-gray-700 space-y-1">
                <p className="font-semibold text-gray-900">{COLLEGE_ADDRESS.name}</p>
                <p>{COLLEGE_ADDRESS.line1}</p>
                <p>{COLLEGE_ADDRESS.line2}</p>
                <p>{COLLEGE_ADDRESS.state}</p>
              </address>
            </div>
            <a
              href={COLLEGE_ADDRESS.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700 sm:flex-shrink-0"
            >
              Get directions
              <IconExternal />
            </a>
          </div>
        </section>

        {/* Social */}
        <section className="mb-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Connect with us
          </h2>
          <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="grid sm:grid-cols-3 gap-4">
              {SOCIAL_LINKS.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1px] transition-transform hover:-translate-y-0.5"
                >
                  <div className="h-full rounded-2xl bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        item.icon === "instagram"
                          ? "bg-white border border-slate-200 text-rose-600"
                          : "bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white"
                      }`}
                    >
                      {item.icon === "linkedin" && (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      )}
                      {item.icon === "instagram" && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M7.5 3h9A4.5 4.5 0 0121 7.5v9a4.5 4.5 0 01-4.5 4.5h-9A4.5 4.5 0 013 16.5v-9A4.5 4.5 0 017.5 3zm0 1.5A3 3 0 004.5 7.5v9A3 3 0 007.5 19.5h9a3 3 0 003-3v-9a3 3 0 00-3-3h-9zm4.5 3A4.5 4.5 0 1112 16.5a4.5 4.5 0 010-9zm0 1.5A3 3 0 1012 15a3 3 0 000-6zm4.65-2.55a.9.9 0 11-.9.9.9.9 0 01.9-.9z" />
                        </svg>
                      )}
                      {item.icon === "website" && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.icon === "website" && "Visit the campus site"}
                        {item.icon === "linkedin" && "Connect with the institute"}
                        {item.icon === "instagram" && "See campus moments"}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className="text-center pt-6 border-t border-gray-200">
          <p className="text-sm sm:text-base text-gray-600 mb-5 leading-relaxed">
            The official campus marketplace for AANM & VVRSR Polytechnic.
          </p>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700"
          >
            Learn more about us
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </footer>
      </div>
    </div>
  );
}
