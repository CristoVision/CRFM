import React from 'react';

const SectionShell = ({ title, icon, subtitle, children }) => (
  <section className="p-6 sm:p-8 glass-effect rounded-xl border border-white/10">
    <header className="mb-6">
      <h2 className="text-3xl sm:text-4xl font-bold golden-text flex items-center">
        {icon ? React.cloneElement(icon, { className: 'w-8 h-8 mr-3 text-yellow-400' }) : null}
        {title}
      </h2>
      {subtitle ? <p className="text-gray-300 text-base sm:text-lg mt-3">{subtitle}</p> : null}
    </header>
    <div className="space-y-4 text-gray-300 text-base sm:text-lg leading-relaxed">
      {children}
    </div>
  </section>
);

export default SectionShell;
