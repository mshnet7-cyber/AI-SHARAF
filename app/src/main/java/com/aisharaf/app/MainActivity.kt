package com.aisharaf.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.URLEncoder

private const val API_BASE = "https://ai-sharaf-api.onrender.com"
private const val USER_ID = "00000000-0000-0000-0000-000000000001"
private val Bg = Color(0xFF0B0F14)
private val Card = Color(0xFF111821)
private val Gold = Color(0xFFD9B24C)
private val Muted = Color(0xFF8C98A6)

enum class Tab(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    CHAT("Chat", Icons.Default.Chat), MEMORY("Memory", Icons.Default.Psychology),
    KNOWLEDGE("Knowledge", Icons.Default.MenuBook), RESEARCH("Research", Icons.Default.Search),
    TASKS("Tasks", Icons.Default.CheckCircle), FILES("Files", Icons.Default.AttachFile),
    SETTINGS("Settings", Icons.Default.Settings)
}

data class ChatMessage(val role: String, val text: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AiSharafApp() }
    }
}

@Composable
fun AiSharafApp() {
    var selected by remember { mutableStateOf(Tab.CHAT) }
    MaterialTheme(colorScheme = darkColorScheme(background = Bg, surface = Card, primary = Gold)) {
        Row(Modifier.fillMaxSize().background(Bg)) {
            NavigationRail(containerColor = Card, contentColor = Color.White) {
                Spacer(Modifier.height(12.dp))
                Text("AI", color = Gold, fontWeight = FontWeight.Bold, modifier = Modifier.padding(8.dp))
                Tab.values().forEach { tab ->
                    NavigationRailItem(selected == tab, { selected = tab }, icon = { Icon(tab.icon, tab.title) }, label = { Text(tab.title, fontSize = 10.sp) }, alwaysShowLabel = false)
                }
            }
            Box(Modifier.weight(1f).fillMaxHeight()) {
                when (selected) {
                    Tab.CHAT -> ChatScreen(); Tab.MEMORY -> MemoryScreen(); Tab.KNOWLEDGE -> KnowledgeScreen()
                    Tab.RESEARCH -> ResearchScreen(); Tab.TASKS -> TasksScreen(); Tab.FILES -> FilesScreen(); Tab.SETTINGS -> SettingsScreen()
                }
            }
        }
    }
}

@Composable
fun Header(title: String, subtitle: String? = null) {
    Column(Modifier.fillMaxWidth().padding(20.dp)) {
        Text(title, fontSize = 25.sp, fontWeight = FontWeight.Bold)
        subtitle?.let { Text(it, color = Muted, fontSize = 13.sp) }
    }
}

@Composable
fun ChatScreen() {
    var input by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    val messages = remember { mutableStateListOf(ChatMessage("assistant", "مرحباً. أنا AI SHARAF. كيف يمكنني مساعدتك؟")) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize()) {
        Header("AI SHARAF", "Chat • Memory • Knowledge • Research")
        LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(messages) { msg -> Row(Modifier.fillMaxWidth(), horizontalArrangement = if (msg.role == "user") Arrangement.End else Arrangement.Start) { Surface(shape = RoundedCornerShape(14.dp), color = if (msg.role == "user") Color(0xFF1D2A37) else Card) { Text(msg.text, Modifier.padding(14.dp), lineHeight = 22.sp) } } }
        }
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(input, { input = it }, Modifier.weight(1f), placeholder = { Text("اكتب رسالتك... / English...") })
            Spacer(Modifier.width(8.dp))
            Button(enabled = input.isNotBlank() && !sending, onClick = { val text = input.trim(); input = ""; messages.add(ChatMessage("user", text)); sending = true; scope.launch { messages.add(ChatMessage("assistant", ApiClient.chat(text))); sending = false } }) { Text(if (sending) "..." else "Send") }
        }
    }
}

@Composable
fun SearchScreen(title: String, subtitle: String, placeholder: String, search: suspend (String) -> List<String>) {
    var query by remember { mutableStateOf("") }; var results by remember { mutableStateOf(emptyList<String>()) }; val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize()) {
        Header(title, subtitle)
        Row(Modifier.padding(horizontal = 16.dp)) { OutlinedTextField(query, { query = it }, Modifier.weight(1f), placeholder = { Text(placeholder) }); Spacer(Modifier.width(8.dp)); Button(onClick = { scope.launch { results = search(query) } }) { Text("Search") } }
        LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { items(results) { item -> Surface(color = Card, shape = RoundedCornerShape(12.dp)) { Text(item, Modifier.padding(14.dp)) } } }
    }
}

@Composable fun MemoryScreen() = SearchScreen("Memory", "Persistent memory and retrieval", "Search memory...") { ApiClient.memorySearch(it) }
@Composable fun KnowledgeScreen() = SearchScreen("Knowledge", "Facts, claims, entities and trusted knowledge", "Search knowledge...") { ApiClient.knowledgeSearch(it) }

@Composable
fun ResearchScreen() {
    var query by remember { mutableStateOf("") }; var result by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize()) { Header("Research", "Research workspace"); OutlinedTextField(query, { query = it }, Modifier.padding(16.dp).fillMaxWidth(), placeholder = { Text("What should AI SHARAF research?") }); Button({ result = "Research Engine endpoint is reserved in v0.2 backend." }, Modifier.padding(horizontal = 16.dp)) { Text("Start Research") }; if (result.isNotBlank()) Surface(color = Card, shape = RoundedCornerShape(14.dp), modifier = Modifier.padding(16.dp).fillMaxWidth()) { Text(result, Modifier.padding(16.dp)) } }
}

@Composable
fun TasksScreen() {
    var objective by remember { mutableStateOf("") }; var result by remember { mutableStateOf("") }; val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize()) { Header("Tasks", "Long-running work and task plans"); OutlinedTextField(objective, { objective = it }, Modifier.padding(16.dp).fillMaxWidth(), placeholder = { Text("Example: دراسة مصنع كسارة 300 طن/ساعة") }); Button({ scope.launch { result = ApiClient.createTask(objective) } }, Modifier.padding(horizontal = 16.dp)) { Text("Create Task") }; if (result.isNotBlank()) Surface(color = Card, shape = RoundedCornerShape(14.dp), modifier = Modifier.padding(16.dp).fillMaxWidth()) { Text(result, Modifier.padding(16.dp)) } }
}

@Composable
fun FilesScreen() { Column(Modifier.fillMaxSize()) { Header("Files", "Document ingestion workspace"); Surface(color = Card, shape = RoundedCornerShape(16.dp), modifier = Modifier.padding(16.dp).fillMaxWidth()) { Column(Modifier.padding(20.dp)) { Icon(Icons.Default.AttachFile, null, tint = Gold); Spacer(Modifier.height(10.dp)); Text("PDF / Books / Images / Documents", fontWeight = FontWeight.Bold); Text("File ingestion is prepared in the architecture. The v0.1 backend still needs the multipart upload endpoint.", color = Muted) } } } }

@Composable
fun SettingsScreen() { Column(Modifier.fillMaxSize()) { Header("Settings", "AI SHARAF connection"); Surface(color = Card, shape = RoundedCornerShape(16.dp), modifier = Modifier.padding(16.dp).fillMaxWidth()) { Column(Modifier.padding(20.dp)) { Text("Backend API", fontWeight = FontWeight.Bold); Text(API_BASE, color = Muted); Spacer(Modifier.height(16.dp)); Text("User ID", fontWeight = FontWeight.Bold); Text(USER_ID, color = Muted, fontSize = 12.sp); Spacer(Modifier.height(16.dp)); Text("Version 2.0", color = Gold, fontWeight = FontWeight.Bold) } } } }

object ApiClient {
    private val client = OkHttpClient(); private val jsonType = "application/json".toMediaType()
    suspend fun chat(message: String): String = withContext(Dispatchers.IO) { try { val body = JSONObject().put("user_id", USER_ID).put("message", message).toString().toRequestBody(jsonType); val req = Request.Builder().url("$API_BASE/chat").post(body).build(); client.newCall(req).execute().use { res -> val raw = res.body?.string().orEmpty(); if (!res.isSuccessful) return@withContext "API error ${res.code}"; JSONObject(raw).optString("answer", "لم تصل إجابة.") } } catch (e: Exception) { "تعذر الاتصال بـ AI SHARAF.\n${e.message}" } }
    suspend fun memorySearch(query: String): List<String> = searchList("$API_BASE/memory/search?user_id=$USER_ID&q=${URLEncoder.encode(query, "UTF-8")}") { x -> "${x.optString("memory_type")}: ${x.optString("content")} [confidence=${x.opt("confidence")}]" }
    suspend fun knowledgeSearch(query: String): List<String> = searchList("$API_BASE/knowledge/search?q=${URLEncoder.encode(query, "UTF-8")}") { x -> "${x.optString("title")}: ${x.optString("content")} [${x.optString("verification_status")}]" }
    private suspend fun searchList(url: String, format: (JSONObject) -> String): List<String> = withContext(Dispatchers.IO) { try { client.newCall(Request.Builder().url(url).get().build()).execute().use { res -> val arr = JSONObject(res.body?.string().orEmpty()).optJSONArray("results") ?: return@withContext emptyList(); (0 until arr.length()).map { format(arr.getJSONObject(it)) } } } catch (_: Exception) { emptyList() } }
    suspend fun createTask(objective: String): String = withContext(Dispatchers.IO) { try { val body = JSONObject().put("user_id", USER_ID).put("objective", objective).put("priority", 5).toString().toRequestBody(jsonType); client.newCall(Request.Builder().url("$API_BASE/tasks").post(body).build()).execute().use { res -> val json = JSONObject(res.body?.string().orEmpty()); "Task created:\n${json.optString("task_id")}\nStatus: ${json.optString("status")}" } } catch (e: Exception) { "Task error: ${e.message}" } }
}
