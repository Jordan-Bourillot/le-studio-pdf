; ============================================================
;  Le Studio PDF — installeur Windows (Inno Setup)
;  Compilation : double-cliquer sur build_installer.bat
;  Sortie : installer_output\LeStudioPDF_setup.exe
; ============================================================

#define MyAppName "Le Studio PDF"
#define MyAppVersion "2.7.0"
#define MyAppPublisher "Triskell Studio"
#define MyAppURL "https://triskell-studio.fr"
#define MyAppExeName "LeStudioPDF.exe"

[Setup]
AppId={{C8AD5A37-3F4E-4B9D-8E3F-92B7A1F4C2D8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\Le Studio PDF
DefaultGroupName=Le Studio PDF
DisableProgramGroupPage=yes
LicenseFile=
InfoBeforeFile=
InfoAfterFile=
OutputDir=..\installer_output
OutputBaseFilename=LeStudioPDF_setup_{#MyAppVersion}
SetupIconFile=..\ui\assets\bertrand.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} — l'atelier PDF de Bertrand
VersionInfoProductName={#MyAppName}
VersionInfoVersion={#MyAppVersion}

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le {cm:UninstallProgram,bureau}"; GroupDescription: "Raccourcis supplémentaires :"; Flags: unchecked
Name: "quicklaunchicon"; Description: "Créer un raccourci dans la barre de lancement rapide"; GroupDescription: "Raccourcis supplémentaires :"; Flags: unchecked; OnlyBelowVersion: 6.1

[Files]
Source: "..\dist\LeStudioPDF\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\LeStudioPDF\_internal\*"; DestDir: "{app}\_internal"; Flags: ignoreversion recursesubdirs createallsubdirs
; Prerequis embarques (suppression apres install)
Source: "prereqs\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "prereqs\ndp48-web.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Désinstaller {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Installation Visual C++ Redistributable (silencieuse, l installeur skip s il est deja la)
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installation des bibliothèques Visual C++..."; Flags: waituntilterminated; Check: NeedsVCRedist
; Installation .NET Framework 4.8 si manquant
Filename: "{tmp}\ndp48-web.exe"; Parameters: "/q /norestart"; StatusMsg: "Installation de .NET Framework 4.8 (requis par Le Studio PDF)..."; Flags: waituntilterminated; Check: NeedsDotNet48
; Lancer l app a la fin
Filename: "{app}\{#MyAppExeName}"; Description: "Lancer {#MyAppName} maintenant"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
function NeedsDotNet48: Boolean;
var
  ReleaseValue: Cardinal;
begin
  Result := True;
  if RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full', 'Release', ReleaseValue) then
  begin
    // 528040 = .NET 4.8 sur Windows 10 May 2019 Update et plus recent
    // 528049 = .NET 4.8 sur autres Windows
    if ReleaseValue >= 528040 then
      Result := False;
  end;
end;

function NeedsVCRedist: Boolean;
var
  Version: String;
begin
  Result := True;
  // Verifie si VC++ 2015-2022 x64 est installe
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Version', Version) then
  begin
    if (Length(Version) > 0) and (Version >= 'v14.30.0.0') then
      Result := False;
  end;
end;
