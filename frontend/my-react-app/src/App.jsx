
import { useState } from "react";
import axios from "axios";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Typography,
  Tag,
  Divider,
  Upload,
  Table,
  message as notification,
} from "antd";
import {
  RobotOutlined,
  SendOutlined,
  CopyOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import "./App.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const API_URL = "http://localhost:5000/api";

export default function App() {
  // Reply generator states
  const [incoming, setIncoming] = useState("");
  const [tone, setTone] = useState("casual");
  const [language, setLanguage] = useState("Hinglish");
  const [reply, setReply] = useState("");
  const [retrievedExamples, setRetrievedExamples] = useState(0);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Training states
  const [samples, setSamples] = useState([]);
  const [fileName, setFileName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [trainingResult, setTrainingResult] = useState(null);
// WhatsApp screenshot states
const [screenshotFiles, setScreenshotFiles] = useState([]);
const [extractingImages, setExtractingImages] = useState(false);
const [extractionResult, setExtractionResult] = useState(null);
  async function generateReply() {
    if (!incoming.trim()) {
      notification.warning("Please enter an incoming message.");
      return;
    }

    setLoading(true);
    setError("");
    setReply("");
    setRetrievedExamples(0);
    setPersonalized(false);

    try {
      const { data } = await axios.post(`${API_URL}/reply`, {
        message: incoming,
        tone,
        language,
      });

      setReply(data.reply || "");
      setRetrievedExamples(data.retrievedExamples || 0);
      setPersonalized(data.personalized || false);

      notification.success("Personalized reply generated!");
    } catch (err) {
      setError(
        err.response?.data?.error ||
        "Unable to connect to ReplyTwin. Check whether the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyReply() {
    if (!reply) return;

    try {
      await navigator.clipboard.writeText(reply);
      notification.success("Reply copied!");
    } catch {
      notification.error("Unable to copy reply.");
    }
  }

  function handleFileUpload(file) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      notification.error("Please upload a JSON file.");
      return Upload.LIST_IGNORE;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        if (!Array.isArray(parsed.samples) || parsed.samples.length === 0) {
          notification.error(
            'JSON must contain a non-empty "samples" array.'
          );
          return;
        }

        setSamples(parsed.samples);
        setFileName(file.name);
        setPreviewResult(null);
        setTrainingResult(null);

        await previewSamples(parsed.samples);
      } catch {
        notification.error("Invalid JSON file. Please check its format.");
      }
    };

    reader.onerror = () => {
      notification.error("Unable to read the selected file.");
    };

    reader.readAsText(file);

    return false;
  }

  function handleScreenshotUpload(file) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      notification.error("Only JPG, PNG and WEBP images are allowed.");
      return Upload.LIST_IGNORE;
    }

    if (file.size > 5 * 1024 * 1024) {
      notification.error("Each image must be smaller than 5 MB.");
      return Upload.LIST_IGNORE;
    }

    if (screenshotFiles.length >= 10) {
      notification.warning("You can upload a maximum of 10 images.");
      return Upload.LIST_IGNORE;
    }

    setScreenshotFiles((previous) => [...previous, file]);
    setExtractionResult(null);

    return false;
  }
async function extractScreenshots() {
  if (screenshotFiles.length === 0) {
    notification.warning("Please upload at least one screenshot.");
    return;
  }

  const formData = new FormData();

  screenshotFiles.forEach((file) => {
    formData.append("screenshots", file);
  });

  try {
    setExtractingImages(true);
    setExtractionResult(null);

    const response = await axios.post(
      `${API_URL}/samples/extract-images`,
      formData
    );

    if (response.data.success) {
      setExtractionResult(response.data);

      // Put extracted samples into the existing review workflow
      setSamples(response.data.samples || []);
if (response.data.samples?.length > 0) {
  await previewSamples(response.data.samples);
}
      notification.success("WhatsApp screenshots extracted successfully!");
    }
  } catch (error) {
    console.error("Screenshot extraction error:", error);

    notification.error(
      error.response?.data?.error ||
      "Unable to extract messages. Please try again."
    );
  } finally {
    setExtractingImages(false);
  }
}
  async function previewSamples(selectedSamples) {
    setPreviewLoading(true);

    try {
      const { data } = await axios.post(
        `${API_URL}/samples/preview`,
        { samples: selectedSamples }
      );

      setPreviewResult(data);
      notification.success("Samples validated successfully.");
    } catch (err) {
      setSamples([]);
      setFileName("");

      notification.error(
        err.response?.data?.error || "Sample validation failed."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function trainAI() {
    if (!samples.length) {
      notification.warning("Please upload chat samples first.");
      return;
    }

    setTrainingLoading(true);
    setTrainingResult(null);

    try {
      const { data } = await axios.post(
        `${API_URL}/samples/ingest`,
        { samples }
      );

      setTrainingResult(data);
      notification.success("ReplyTwin training data stored successfully!");
    } catch (err) {
      notification.error(
        err.response?.data?.error || "Unable to train ReplyTwin."
      );
    } finally {
      setTrainingLoading(false);
    }
  }

  function clearSamples() {
    setSamples([]);
    setFileName("");
    setPreviewResult(null);
    setTrainingResult(null);
  }

  const sampleColumns = [
    {
      title: "Incoming message",
      dataIndex: "incoming_message",
      key: "incoming_message",
      render: (value) => <Text>{value}</Text>,
    },
    {
      title: "Your reply",
      dataIndex: "my_reply",
      key: "my_reply",
      render: (value) => <Text>{value}</Text>,
    },
    {
      title: "Tone",
      dataIndex: "tone",
      key: "tone",
    },
    {
      title: "Language",
      dataIndex: "language",
      key: "language",
    },
  ];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <Text className="eyebrow">
            PERSONAL AI COMMUNICATION AGENT
          </Text>
          <Title level={2}>
            ReplyTwin <RobotOutlined />
          </Title>
          <Text type="secondary">
            Your communication style, powered by AI.
          </Text>
        </div>

        <span className="status-pill">AI Copilot</span>
      </header>

      {/* REPLY GENERATOR */}

      <div className="dashboard-grid">
        <Card className="chat-card">
          <div className="section-heading">
            <div>
              <Title level={4}>Create a reply</Title>
              <Text type="secondary">
                Generate a response using your previous chat examples.
              </Text>
            </div>
            <RobotOutlined className="heading-icon" />
          </div>

          <label className="field-label">Incoming message</label>

          <TextArea
            value={incoming}
            onChange={(event) => setIncoming(event.target.value)}
            placeholder="Example: Can you share the project update by EOD?"
            rows={5}
            maxLength={2000}
            showCount
          />

          <div className="controls">
            <label>
              <Text strong>Tone</Text>
              <Select
  styles={{
    root: { width: "100%", background: "#24211d",
      border: "1px solid #49443a",
      borderRadius: "10px",
      boxShadow: "none",},
    selector: {
      background: "#24211d",
      border: "1px solid #49443a",
      borderRadius: "10px",
      boxShadow: "none",
    },
    selection: {
      color: "#f0e9dd",
    },
  }}
  value={tone}
  onChange={setTone}
  options={[
    { value: "casual", label: "Casual" },
    { value: "professional", label: "Professional" },
    { value: "friendly", label: "Friendly" },
  ]}
/>
            </label>

            <label>
              <Text strong>Language</Text>
             <Select
  styles={{
    root: {  width: "100%", background: "#24211d",
      border: "1px solid #49443a",
      borderRadius: "10px",
      boxShadow: "none", },
    selector: {
      background: "#24211d",
      border: "1px solid #49443a",
      borderRadius: "10px",
      boxShadow: "none",
    },
    selection: {
      color: "#f0e9dd",
    },
  }}
  value={language}
  onChange={setLanguage}
  options={[
    { value: "Hinglish", label: "Hinglish" },
    { value: "English", label: "English" },
  ]}
/>
            </label>
          </div>

          <Button
            type="primary"
            size="large"
            block
            icon={<SendOutlined />}
            loading={loading}
            onClick={generateReply}
          >
            Generate reply
          </Button>

          {error && (
            <Alert
              type="error"
              showIcon
              message="Reply generation failed"
              description={error}
            />
          )}
        </Card>

        {/* GENERATED REPLY */}

        <Card className="reply-card">
          <Text className="eyebrow">YOUR AI-GENERATED DRAFT</Text>
          <Title level={4}>Suggested reply</Title>

          {reply ? (
            <>
              <TextArea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={6}
              />

              <Space wrap>
                <Button icon={<CopyOutlined />} onClick={copyReply}>
                  Copy reply
                </Button>

                <Button
                  icon={<ReloadOutlined />}
                  onClick={generateReply}
                  loading={loading}
                >
                  Regenerate
                </Button>
              </Space>

              <Divider />

              <div className="rag-status">
                <Text strong>
                  <DatabaseOutlined /> RAG retrieval status
                </Text>

                <div style={{ marginTop: 12 }}>
                  <Tag color="success">RAG enabled</Tag>
                  <Tag color={personalized ? "success" : "default"}>
                    {personalized ? "Personalized reply" : "No matching examples"}
                  </Tag>
                </div>

                <Title level={3} style={{ margin: "12px 0 0" }}>
                  {retrievedExamples}
                </Title>

                <Text type="secondary">
                  Similar conversations retrieved
                </Text>
              </div>
            </>
          ) : (
            <div className="empty-reply">
              <RobotOutlined className="empty-icon" />
              <Text strong>Your reply will appear here</Text>
              <Text type="secondary">
                Enter a message and click Generate reply.
              </Text>
            </div>
          )}

          <div className="prototype-note">
            <Text type="secondary">
              Replies use semantic search and your previous chat samples.
            </Text>
          </div>
        </Card>
      </div>

      {/* TRAIN YOUR AI */}

      <Card className="training-card">
        <div className="section-heading">
          <div>
            <Text className="eyebrow">PERSONALIZE YOUR AI</Text>
            <Title level={4}>Train Your AI</Title>
            <Text type="secondary">
              Upload previous conversations to teach ReplyTwin your writing style.
            </Text>
          </div>
          <CloudUploadOutlined className="heading-icon" />
        </div>

        {/* WHATSAPP SCREENSHOT UPLOAD */}
        <div className="screenshot-upload-section">
          <Divider />

          <Typography.Title level={4}>
            <CloudUploadOutlined /> Import WhatsApp Chats
          </Typography.Title>

          <Typography.Paragraph type="secondary">
            Upload up to 10 WhatsApp chat screenshots.
            ReplyTwin will extract messages and create training samples.
          </Typography.Paragraph>

          <Upload
            accept="image/jpeg,image/png,image/webp"
            multiple
            showUploadList={false}
            beforeUpload={handleScreenshotUpload}
          >
            <Button icon={<CloudUploadOutlined />}>
              Select WhatsApp Screenshots
            </Button>
          </Upload>

          {screenshotFiles.length > 0 && (
            <div className="screenshot-file-list">
              {screenshotFiles.map((file, index) => (
                <div className="screenshot-file-item" key={file.uid || index}>
                  <Space>
                    <FileTextOutlined />
                    <Typography.Text>{file.name}</Typography.Text>
                  </Space>

                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      setScreenshotFiles((previous) =>
                        previous.filter((_, i) => i !== index)
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            type="primary"
            icon={<RobotOutlined />}
            loading={extractingImages}
            disabled={screenshotFiles.length === 0}
            onClick={extractScreenshots}
            style={{ marginTop: 16 }}
          >
            Extract Chat Messages
          </Button>

          {extractionResult && (
            <Alert
              style={{ marginTop: 16 }}
              type="success"
              showIcon
              message="Screenshot extraction completed"
              description={`Images: ${extractionResult.totalImages} | Messages: ${extractionResult.totalMessages} | Training samples: ${extractionResult.totalSamples}`}
            />
          )}
        </div>

        <div className="upload-area">
          <FileTextOutlined className="upload-icon" />

          <Title level={5}>Upload your chat samples</Title>

          <Text type="secondary">
            Select a JSON file containing your previous conversations.
          </Text>

          <Upload
            accept=".json,application/json"
            maxCount={1}
            showUploadList={false}
            beforeUpload={handleFileUpload}
          >
            <Button icon={<CloudUploadOutlined />} loading={previewLoading}>
              Select JSON file
            </Button>
          </Upload>

          {fileName && (
            <div className="selected-file">
              <FileTextOutlined />
              <Text strong>{fileName}</Text>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={clearSamples}
              />
            </div>
          )}
        </div>

        {previewLoading && (
          <Alert
            type="info"
            showIcon
            message="Validating your chat samples..."
          />
        )}

        {previewResult && (
          <>
            <Divider />

            <Title level={5}>Sample preview</Title>

            <div className="training-stats">
              <div className="stat-box">
                <Text type="secondary">Received</Text>
                <Title level={3}>
                  {previewResult.totalReceived}
                </Title>
              </div>

              <div className="stat-box">
                <Text type="secondary">Valid samples</Text>
                <Title level={3}>
                  {previewResult.totalValid}
                </Title>
              </div>

              <div className="stat-box">
                <Text type="secondary">Duplicates</Text>
                <Title level={3}>
                  {previewResult.duplicatesRemoved}
                </Title>
              </div>
            </div>

            <Table
              rowKey={(record, index) =>
                `${record.incoming_message}-${index}`
              }
              columns={sampleColumns}
              dataSource={previewResult.samples}
              pagination={{ pageSize: 5 }}
              scroll={{ x: 650 }}
              size="small"
            />

            <Button
              type="primary"
              size="large"
              block
              icon={<RobotOutlined />}
              loading={trainingLoading}
              disabled={trainingLoading || previewResult.totalValid === 0}
              onClick={trainAI}
            >
              Confirm & Train ReplyTwin
            </Button>
          </>
        )}

        {trainingResult && (
          <Alert
            type="success"
            showIcon
            message="ReplyTwin training data stored successfully!"
            description={
              `Received: ${trainingResult.totalReceived} | ` +
              `Stored: ${trainingResult.totalStored} | ` +
              `Duplicates removed: ${trainingResult.duplicatesRemoved}`
            }
          />
        )}
      </Card>
    </main>
  );
}
