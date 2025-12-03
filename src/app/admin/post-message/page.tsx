"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type TargetType = "user_id" | "segment";

interface User {
  id: string;
  phoneNumber?: string;
  name?: string;
  email?: string;
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  if (!res.ok) {
    throw new Error("Failed to fetch users");
  }
  const data = await res.json();
  return data.users || [];
}

export default function PostMessagePage() {
  const [targetType, setTargetType] = useState<TargetType>("user_id");
  const [userId, setUserId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [source, setSource] = useState("");
  const [payload, setPayload] = useState("{}");
  const [bribePayload, setBribePayload] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    success?: boolean;
    messageId?: string;
    error?: string;
    details?: string;
  } | null>(null);

  // Load users with TanStack Query
  const {
    data: users = [],
    isLoading: loadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    try {
      // Build target based on type
      let target;
      switch (targetType) {
        case "user_id":
          target = { type: "user_id", userId }; // userId here is the UUID from the dropdown
          break;
        case "segment":
          target = { type: "segment", segmentId };
          break;
      }

      // Parse JSON payloads
      let parsedPayload;
      let parsedBribePayload;

      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        throw new Error("Invalid JSON in payload field");
      }

      if (bribePayload.trim()) {
        try {
          parsedBribePayload = JSON.parse(bribePayload);
        } catch {
          throw new Error("Invalid JSON in bribePayload field");
        }
      }

      // Build request body
      const body: {
        target: unknown;
        source: string;
        payload: unknown;
        bribePayload?: unknown;
      } = {
        target,
        source,
        payload: parsedPayload,
      };

      if (parsedBribePayload) {
        body.bribePayload = parsedBribePayload;
      }

      // Send request
      const res = await fetch("/api/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({
        error: "Client Error",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">
            Post Message
          </h1>
          <p className="text-gray-600 mb-6">
            Test the /api/message webhook endpoint
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Target Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Type *
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as TargetType)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              >
                <option value="user_id">User ID</option>
                <option value="segment">Segment</option>
              </select>
            </div>

            {/* Conditional Target Fields */}
            {targetType === "user_id" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User *
                </label>
                {loadingUsers ? (
                  <div className="text-sm text-gray-500">Loading users...</div>
                ) : usersError ? (
                  <div className="text-sm text-red-600">
                    Error loading users. Please refresh the page.
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-sm text-red-600">
                    No users found. Please{" "}
                    <a
                      href="/admin/users"
                      className="underline"
                      target="_blank"
                    >
                      create users
                    </a>{" "}
                    first.
                  </div>
                ) : (
                  <>
                    <select
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      required
                    >
                      <option value="">Select a user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.id.slice(0, 8)}
                          {user.phoneNumber && ` (${user.phoneNumber})`}
                          {user.email && ` - ${user.email}`}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      {users.length} user{users.length !== 1 ? "s" : ""}{" "}
                      available
                    </p>
                  </>
                )}
              </div>
            )}

            {targetType === "segment" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segment ID *
                </label>
                <input
                  type="text"
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                  placeholder="e.g., segment_premium_users"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                />
              </div>
            )}

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source *
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g., merchant_123, user_456, admin_panel"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Identifier for the user/merchant sending the message
              </p>
            </div>

            {/* Payload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payload (JSON) *
              </label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={6}
                placeholder='{"message": "Hello!", "type": "notification"}'
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm text-gray-900"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Generic message payload as JSON
              </p>
            </div>

            {/* Bribe Payload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bribe Payload (JSON, Optional)
              </label>
              <textarea
                value={bribePayload}
                onChange={(e) => setBribePayload(e.target.value)}
                rows={4}
                placeholder='{"amount": 100, "currency": "USD", "transactionId": "txn_123"}'
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm text-gray-900"
              />
              <p className="text-sm text-gray-500 mt-1">
                Optional payment metadata
              </p>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>

          {/* Response Display */}
          {response && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2 text-gray-900">
                Response
              </h2>
              <div
                className={`p-4 rounded-md ${
                  response.success
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <pre className="text-sm overflow-x-auto text-gray-900">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
