import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Users, Mail, Package, Gamepad2, BookOpen, Briefcase, Store, Tag } from 'lucide-react';
import RequestCreatorTagsTab from '@/components/about/RequestCreatorTagsTab';
import PublicAppsDisplay from '@/components/about/PublicAppsDisplay';
import PublicGamesDisplay from '@/components/about/PublicGamesDisplay';
import SupportContactPanel from '@/components/about/SupportContactPanel';
function TextContent({
  title,
  children,
  icon
}) {
  return <div className="p-6 sm:p-8 glass-effect rounded-xl min-h-[50vh]">
          <h2 className="text-3xl sm:text-4xl font-bold golden-text mb-6 flex items-center">
            {icon && React.cloneElement(icon, {
        className: "w-8 h-8 mr-3 text-yellow-400"
      })}
            {title}
          </h2>
          <div className="space-y-4 text-gray-300 text-base sm:text-lg leading-relaxed">
            {children}
          </div>
        </div>;
}
function PlaceholderEcosystemContent({
  title,
  icon,
  children
}) {
  return <div className="p-6 sm:p-8 glass-effect rounded-xl min-h-[50vh]">
            <h2 className="text-3xl sm:text-4xl font-bold golden-text mb-6 flex items-center">
              {icon && React.cloneElement(icon, {
        className: "w-8 h-8 mr-3 text-yellow-400"
      })}
              {title}
            </h2>
            <div className="space-y-4 text-gray-300 text-base sm:text-lg leading-relaxed">
              {children || <p>Content for this section is coming soon. Stay tuned for exciting updates!</p>}
            </div>
          </div>;
}
function AboutPage() {
  return <div className="container mx-auto px-4 py-8 page-gradient-bg"> {/* Applied page-gradient-bg here */}
          <div className="text-center mb-12 mt-8">
            <h1 className="text-5xl font-bold mb-4">
              About <span className="golden-text">CRFM</span>
            </h1>
            <p className="text-xl text-gray-300">
              Learn more about our vision, team, and how to connect with us.
            </p>
          </div>

          <div className="max-w-5xl mx-auto space-y-8">
            <Tabs defaultValue="vision" className="w-full">
              <TabsList
                className="w-full px-3 py-2 bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl justify-start sm:justify-center"
                style={{ scrollbarWidth: 'none' }}
              >
                <TabsTrigger value="vision" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Eye className="w-4 h-4 mr-1 sm:mr-2" />Vision</TabsTrigger>
                <TabsTrigger value="team" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Users className="w-4 h-4 mr-1 sm:mr-2" />Team</TabsTrigger>
                <TabsTrigger value="contact" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Mail className="w-4 h-4 mr-1 sm:mr-2" />Contact</TabsTrigger>
                <TabsTrigger value="ecosystem" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Package className="w-4 h-4 mr-1 sm:mr-2" />Ecosystem</TabsTrigger>
                <TabsTrigger value="requestTags" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Tag className="w-4 h-4 mr-1 sm:mr-2" />Request Tags</TabsTrigger>
              </TabsList>

              <TabsContent value="vision">
                <TextContent title="Our Vision" icon={<Eye />}>
                  <p>At CRFM, we believe music is far more than sound—it’s story, spirit, and shared experience. We empower artists and listeners with a dynamic platform that brings lyrics to life, deepens connections, and turns every song into a living narrative. Our vision is anchored by three pillars: Unifying Sound & Story — synchronizing lyrics to the beat so you can see and feel every word; Building Community — connecting fans directly with the hearts behind the music; and Elevating Expression — with intuitive, kingdom-centered tools that let creators share faith-filled messages with clarity and impact. Join us as we redefine music streaming—one synced lyric at a time—amplifying stories of faith, bringing harmony to hearts, and creating a world where every song points back to the One who gave us the gift of creativity.</p>
                  <p></p>
                  <p></p>
                </TextContent>
              </TabsContent>
              <TabsContent value="team">
                <TextContent title="Our Team" icon={<Users />}>
                  <p>CRFM is powered by Luis Antonio De Jesus Figueroa (CristoVision)—a devout Christian, disabled veteran, and veteran recruiter whose blend of coding, design, and music production drives every feature; from synced-lyrics and artwork to the front-end experience. As the sole founder, Luis ensures a faith-driven, creator-first platform that uplifts artists, connects communities, and glorifies the Creator.</p>
                  <p></p>
                  <p></p>
                </TextContent>
              </TabsContent>
              <TabsContent value="contact">
                <div className="space-y-6">
                  <TextContent title="Contact Us" icon={<Mail />}>
                    <p>We'd love to hear from you! Whether you have questions, feedback, or partnership inquiries, feel free to reach out.</p>
                    <p><strong>Email:</strong> <a href="mailto:contact@crfm.com" className="text-yellow-400 hover:underline">contact@crfm.com</a> (Placeholder)</p>
                    <p><strong>Support:</strong> <a href="mailto:support@crfm.com" className="text-yellow-400 hover:underline">support@crfm.com</a> (Placeholder)</p>
                  </TextContent>
                  <SupportContactPanel />
                </div>
              </TabsContent>
              <TabsContent value="ecosystem">
                  <Tabs defaultValue="apps" className="w-full mt-4">
                      <TabsList
                        className="w-full px-2 py-2 bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg justify-start sm:justify-center"
                        style={{ scrollbarWidth: 'none' }}
                      >
                          <TabsTrigger value="apps" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Package className="w-3 h-3 mr-1" />Apps</TabsTrigger>
                          <TabsTrigger value="games" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Gamepad2 className="w-3 h-3 mr-1" />Games</TabsTrigger>
                          <TabsTrigger value="stories" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><BookOpen className="w-3 h-3 mr-1" />Stories</TabsTrigger>
                          <TabsTrigger value="portfolio" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Briefcase className="w-3 h-3 mr-1" />Portfolio</TabsTrigger>
                          <TabsTrigger value="stores" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Store className="w-3 h-3 mr-1" />Stores</TabsTrigger>
                      </TabsList>
                      <TabsContent value="apps">
                          <PublicAppsDisplay />
                      </TabsContent>
                      <TabsContent value="games">
                          <PublicGamesDisplay />
                      </TabsContent>
                      <TabsContent value="stories">
                          <PlaceholderEcosystemContent title="Stories" icon={<BookOpen />} />
                      </TabsContent>
                      <TabsContent value="portfolio">
                          <PlaceholderEcosystemContent title="Portfolio Tools" icon={<Briefcase />} />
                      </TabsContent>
                      <TabsContent value="stores">
                          <PlaceholderEcosystemContent title="Digital Stores" icon={<Store />} />
                      </TabsContent>
                  </Tabs>
              </TabsContent>
              <TabsContent value="requestTags">
                <RequestCreatorTagsTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>;
}
export default AboutPage;
