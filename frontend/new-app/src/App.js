
import React, { useState } from "react";
import "./App.css";

const quickActions = [
  {
    icon: "✉",
    title: "Write an email",
    description: "Draft a clear, professional email",
    prompt: "Help me write a professional email",
    color: "purple",
  },
  {
    icon: "▤",
    title: "Summarize text",
    description: "Turn long content into key points",
    prompt: "Help me summarize a piece of text",
    color: "blue",
  },
  {
    icon: "◷",
    title: "Plan my day",
    description: "Organize tasks and priorities",
    prompt: "Help me plan my day and prioritize tasks",
    color: "orange",
  },
  {
    icon: "✧",
    title: "Generate ideas",
    description: "Brainstorm something new",
    prompt: "Help me brainstorm some creative ideas",
    color: "green",
  },
];

const initialActivities = [
  {
    icon: "✉",
    title: "Drafted a follow-up email",
    category: "Writing",
    time: "Today, 10:42 AM",
    status: "Completed",
    color: "purple",
  },
  {
    icon: "▤",
    title: "Summarized project notes",
    category: "Productivity",
    time: "Today, 9:15 AM",
    status: "Completed",
    color: "blue",
  },
  {
    icon: "◷",
    title: "Created a daily task plan",
    category: "Planning",
    time: "Yesterday",
    status: "Completed",
    color: "orange",
  },
];

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [activities, setActivities] = useState(initialActivities);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { name: "Overview", icon: "▦" },
    { name: "AI Chat", icon: "◌" },
    { name: "Tasks", icon: "☑" },
    { name: "History", icon: "↶" },
    { name: "Settings", icon: "⚙" },
  ];

  const sendMessage = (text) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const newUserMessage = {
      id: Date.now(),
      role: "user",
      text: trimmedText,
    };

    const demoResponse = {
      id: Date.now() + 1,
      role: "assistant",
      text: `I can help you with that! Your request is: "${trimmedText}". This is a demo response for now. Once we connect an AI API, ReplyTwin will generate real AI-powered answers.`,
    };

    setMessages((previous) => [...previous, newUserMessage, demoResponse]);
    setPrompt("");
    setActivePage("AI Chat");

    setActivities((previous) => [
      {
        icon: "✧",
        title:
          trimmedText.length > 32
            ? `${trimmedText.slice(0, 32)}…`
            : trimmedText,
        category: "AI Chat",
        time: "Just now",
        status: "Completed",
        color: "purple",
      },
      ...previous,
    ].slice(0, 4));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(prompt);
  };

  const handleQuickAction = (actionPrompt) => {
    setActivePage("AI Chat");
    setPrompt(actionPrompt);
  };

  const renderOverview = () => (
    <>
      <section className="welcome-section">
        <div className="welcome-copy">
          <span className="eyebrow">
            <span className="sparkle">✦</span> YOUR PERSONAL AI WORKSPACE
          </span>
          <h1>
            Good afternoon!
            <br />
            What can I help you <span>with today?</span>
          </h1>
          <p>
            Your personal AI assistant is ready to help you think, create,
            and get things done.
          </p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-glow">
            <span>✦</span>
          </div>
          <span className="art-spark spark-one">✧</span>
          <span className="art-spark spark-two">✦</span>
          <span className="art-spark spark-three">·</span>
        </div>
      </section>

      <section className="prompt-card">
        <div className="prompt-heading">
          <div className="prompt-heading-icon">✧</div>
          <div>
            <h2>Ask ReplyTwin anything</h2>
            <p>Write a prompt and let your AI assistant help you.</p>
          </div>
        </div>
        <form className="prompt-form" onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(prompt);
              }
            }}
            placeholder="Ask me to write, plan, summarize, brainstorm..."
            rows={3}
            aria-label="Ask ReplyTwin"
          />
          <div className="prompt-footer">
            <span className="prompt-hint">
              <span className="hint-dot" /> Your AI workspace, all in one place
            </span>
            <button className="send-button" type="submit">
              <span>Send prompt</span>
              <span className="send-arrow">↗</span>
            </button>
          </div>
        </form>
      </section>

      <section className="quick-section">
        <div className="section-heading">
          <div>
            <h2>Quick actions</h2>
            <p>Get started with something useful</p>
          </div>
          <span className="section-count">4 tools</span>
        </div>
        <div className="quick-grid">
          {quickActions.map((action) => (
            <button
              className="quick-card"
              key={action.title}
              onClick={() => handleQuickAction(action.prompt)}
              type="button"
            >
              <span className={`quick-icon ${action.color}`}>
                {action.icon}
              </span>
              <span className="quick-card-title">{action.title}</span>
              <span className="quick-card-description">
                {action.description}
              </span>
              <span className="quick-card-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      <ActivitySection activities={activities} />
    </>
  );

  const renderChat = () => (
    <section className="content-panel chat-panel">
      <div className="page-heading">
        <span className="eyebrow">YOUR AI ASSISTANT</span>
        <h1>AI Chat</h1>
        <p>Ask questions, explore ideas, and get help with your work.</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-chat-icon">✧</div>
            <h2>Let's make something happen.</h2>
            <p>Send a message below to start chatting with ReplyTwin.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              className={`chat-message ${message.role}`}
              key={message.id}
            >
              <div className="message-avatar">
                {message.role === "assistant" ? "✦" : "Y"}
              </div>
              <div className="message-content">
                <span className="message-author">
                  {message.role === "assistant" ? "ReplyTwin" : "You"}
                </span>
                <p>{message.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form className="prompt-form chat-input-form" onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage(prompt);
            }
          }}
          placeholder="Message ReplyTwin..."
          rows={2}
          aria-label="Chat message"
        />
        <div className="prompt-footer">
          <span className="prompt-hint">Enter to send · Shift + Enter for a new line</span>
          <button className="send-button" type="submit">
            <span>Send</span>
            <span className="send-arrow">↗</span>
          </button>
        </div>
      </form>
      <p className="demo-note">
        Demo mode: responses are simulated until an AI API is connected.
      </p>
    </section>
  );

  const renderTasks = () => (
    <section className="content-panel">
      <div className="page-heading">
        <span className="eyebrow">STAY ORGANIZED</span>
        <h1>Tasks & activity</h1>
        <p>See the work you've asked ReplyTwin to help you with.</p>
      </div>
      <ActivitySection activities={activities} />
    </section>
  );

  const renderHistory = () => (
    <section className="content-panel">
      <div className="page-heading">
        <span className="eyebrow">YOUR WORKSPACE</span>
        <h1>Recent history</h1>
        <p>Your latest activity is collected here.</p>
      </div>
      <ActivitySection activities={activities} />
    </section>
  );

  const renderSettings = () => (
    <section className="content-panel">
      <div className="page-heading">
        <span className="eyebrow">MAKE IT YOURS</span>
        <h1>Settings</h1>
        <p>Manage your ReplyTwin workspace preferences.</p>
      </div>
      <div className="settings-card">
        <div className="settings-avatar">Y</div>
        <div className="settings-info">
          <h3>Your workspace</h3>
          <p>Personal AI assistant · Demo mode</p>
        </div>
        <span className="settings-badge">Active</span>
      </div>
      <div className="settings-card">
        <div className="settings-setting-icon">✧</div>
        <div className="settings-info">
          <h3>AI connection</h3>
          <p>Connect an AI API later to enable real responses.</p>
        </div>
        <span className="settings-badge pending">Not connected</span>
      </div>
    </section>
  );

  const pageContent = {
    Overview: renderOverview,
    "AI Chat": renderChat,
    Tasks: renderTasks,
    History: renderHistory,
    Settings: renderSettings,
  };

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button
          className="brand"
          type="button"
          onClick={() => {
            setActivePage("Overview");
            setSidebarOpen(false);
          }}
        >
          <span className="brand-mark">✦</span>
          <span className="brand-name">
            Reply<span>Twin</span>
            <small>PERSONAL AI AGENT</small>
          </span>
        </button>

        <div className="nav-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={`nav-item ${
                activePage === item.name ? "active" : ""
              }`}
              key={item.name}
              type="button"
              onClick={() => {
                setActivePage(item.name);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
              {item.name === "Tasks" && (
                <span className="nav-count">{activities.length}</span>
              )}
              {activePage === item.name && <span className="active-line" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">✦</div>
            <h3>Your ideas, amplified.</h3>
            <p>Your personal AI space to do more with less effort.</p>
            <button
              type="button"
              onClick={() => {
                setActivePage("AI Chat");
                setSidebarOpen(false);
              }}
            >
              Start chatting <span>↗</span>
            </button>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">Y</div>
            <div className="profile-copy">
              <strong>Your workspace</strong>
              <span>Personal account</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              type="button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="online-status">
              <span /> AI assistant ready
            </span>
            <button
              className="topbar-avatar"
              type="button"
              aria-label="Open settings"
              onClick={() => setActivePage("Settings")}
            >
              Y
            </button>
          </div>
        </header>

        <div className="page-content">
          {pageContent[activePage]()}
          <footer className="app-footer">
            <span>© 2026 ReplyTwin</span>
            <span>Made for your everyday productivity <span className="footer-spark">✦</span></span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function ActivitySection({ activities }) {
  return (
    <section className="activity-section">
      <div className="section-heading">
        <div>
          <h2>Recent activity</h2>
          <p>A little progress goes a long way</p>
        </div>
        <span className="activity-live">
          <span /> Live updates
        </span>
      </div>

      <div className="activity-card">
        {activities.length === 0 ? (
          <div className="no-activity">Your activity will appear here.</div>
        ) : (
          activities.map((activity, index) => (
            <div className="activity-row" key={`${activity.title}-${index}`}>
              <div className={`activity-icon ${activity.color}`}>
                {activity.icon}
              </div>
              <div className="activity-details">
                <strong>{activity.title}</strong>
                <span>
                  {activity.category} <span className="activity-dot">·</span>{" "}
                  {activity.time}
                </span>
              </div>
              <span className="activity-status">
                <span /> {activity.status}
              </span>
              <span className="activity-more">···</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default App;
