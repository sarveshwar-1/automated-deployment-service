-- Traffic tracking script for NGINX
-- Tracks requests per endpoint for traffic-based isolation

local traffic_stats = ngx.shared.traffic_stats

-- Build a key for this endpoint
local project_id = ngx.var.project_id
local path = ngx.var.path_remainder or "/"

-- Normalize path (first segment only for grouping)
local endpoint = path:match("^(/[^/]*)") or "/"
local key = project_id .. ":" .. endpoint

-- Get current minute bucket
local minute = os.date("%Y%m%d%H%M")
local stat_key = key .. ":" .. minute

-- Increment counter
local count, err = traffic_stats:incr(stat_key, 1, 0, 120)  -- 2 min TTL
if not count then
    ngx.log(ngx.WARN, "Failed to track traffic: " .. (err or "unknown"))
end
